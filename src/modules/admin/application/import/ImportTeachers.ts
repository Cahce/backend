import { z } from "zod";
import type { DepartmentRepo } from "../../domain/Department/Ports.js";
import type { TeacherProfileRepo } from "../../domain/TeacherManagement/Ports.js";
import type { TeacherProfile } from "../../domain/TeacherManagement/Types.js";
import type { AdminAccountRepo } from "../../domain/AccountManagement/Ports.js";
import type { PasswordHasher } from "../../domain/shared/PasswordHasher.js";
import { ImportService, type ImportResult, type GeneratedPassword } from "./ImportTypes.js";
import { EnvEmailPolicy } from "../../domain/AccountManagement/Policies.js";
import {
  normalizeRow,
  SequentialCodeGenerator,
  type HeaderMap,
} from "./HeaderMap.js";

/**
 * Teacher import row schema
 */
const TeacherImportRowSchema = z.object({
  teacherCode: z.string().min(1, "Mã giảng viên không được để trống"),
  fullName: z.string().min(1, "Tên giảng viên không được để trống"),
  departmentCode: z.string().min(1, "Mã bộ môn không được để trống"),
  academicRank: z.string().default(""),
  academicDegree: z.string().default(""),
  phone: z.string().optional(),
  accountEmail: z.string().optional(),
  accountPassword: z.string().optional(),
});

type TeacherImportRow = z.infer<typeof TeacherImportRowSchema>;

/**
 * Matches columns in "Mẫu Import Giảng viên.xlsx" (STT ignored).
 * "Mã GV" is accepted but not present in the template — when absent the
 * teacher code is auto-generated from the existing DB pattern.
 */
const TEACHER_HEADER_MAP: HeaderMap = {
  "Mã GV": "teacherCode",
  "Họ và Tên": "fullName",
  "Học hàm": "academicRank",
  "Học vị": "academicDegree",
  "Bộ Môn": "departmentCode",
  Email: "accountEmail",
  "Mật Khẩu": "accountPassword",
  "Số điện thoại": "phone",
};

/**
 * Import teachers from CSV with optional account creation.
 *
 * Application use case — depends only on domain ports (department/teacher/account
 * repos + PasswordHasher), never on Prisma or bcrypt directly.
 */
export class ImportTeachers {
  private readonly emailPolicy = new EnvEmailPolicy();

  constructor(
    private readonly departmentRepo: DepartmentRepo,
    private readonly teacherRepo: TeacherProfileRepo,
    private readonly accountRepo: AdminAccountRepo,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(rows: unknown[]): Promise<ImportResult> {
    const generatedPasswords: GeneratedPassword[] = [];

    const normalized = rows.map((row) =>
      normalizeRow(row as Record<string, unknown>, TEACHER_HEADER_MAP),
    );

    // Pre-seed a sequential generator from existing teacherCodes so rows that
    // omit "Mã GV" follow the dominant prefix/digit-width pattern in the DB
    // (e.g., {GV001, GV002} → GV003). Reserves any teacherCode already present
    // in the upload so we never collide.
    const existingCodes = await this.teacherRepo.listAllTeacherCodes();
    const codeGen = new SequentialCodeGenerator(existingCodes);
    for (const row of normalized) {
      const code = (row as { teacherCode?: unknown }).teacherCode;
      if (typeof code === "string" && code.trim() !== "") {
        codeGen.reserve(code.trim());
      }
    }
    for (const row of normalized) {
      const rec = row as Record<string, unknown>;
      if (rec.teacherCode === undefined || rec.teacherCode === "") {
        rec.teacherCode = codeGen.next();
      }
    }

    const result = await ImportService.runImport<TeacherImportRow, TeacherProfile>(
      normalized as TeacherImportRow[],
      {
        validateRow: async (row) => {
          try {
            TeacherImportRowSchema.parse(row);

            if (row.accountEmail) {
              const emailValidation = this.emailPolicy.validate(row.accountEmail, "teacher");
              if (!emailValidation.ok) {
                return {
                  ok: false,
                  code: emailValidation.code,
                  message: emailValidation.message,
                };
              }
            }

            return { ok: true };
          } catch (error) {
            if (error instanceof z.ZodError) {
              return {
                ok: false,
                code: "VALIDATION_ERROR",
                message: error.issues[0].message,
              };
            }
            return {
              ok: false,
              code: "VALIDATION_ERROR",
              message: "Dữ liệu không hợp lệ",
            };
          }
        },

        resolveForeignKeys: async (row) => {
          const department = await this.departmentRepo.findByCode(row.departmentCode);
          if (!department) {
            throw new Error(`Không tìm thấy bộ môn với mã "${row.departmentCode}"`);
          }
          return { departmentId: department.id };
        },

        checkExists: async (row) => {
          const existing = await this.teacherRepo.findByTeacherCode(row.teacherCode);
          return existing !== null;
        },

        createEntity: async (row, resolvedKeys) => {
          if (!resolvedKeys?.departmentId) {
            throw new Error("Department ID not resolved");
          }

          // Handle optional account creation / linking.
          let accountId: string | undefined;

          if (row.accountEmail) {
            const normalizedEmail = EnvEmailPolicy.normalize(row.accountEmail);
            const existingAccount = await this.accountRepo.findByEmail(normalizedEmail);

            if (existingAccount) {
              const linkedTeacher = await this.teacherRepo.findByAccountId(existingAccount.id);
              if (linkedTeacher) {
                throw new Error(
                  `Email "${row.accountEmail}" đã được liên kết với giảng viên khác`,
                );
              }
              accountId = existingAccount.id;
            } else {
              let password = row.accountPassword;
              let isGenerated = false;
              if (!password) {
                password = ImportService.generatePassword();
                isGenerated = true;
              }

              const passwordHash = await this.passwordHasher.hash(password);
              const account = await this.accountRepo.create({
                email: normalizedEmail,
                passwordHash,
                role: "teacher",
                isActive: true,
              });
              accountId = account.id;

              if (isGenerated) {
                generatedPasswords.push({
                  row: 0, // Will be set by caller
                  email: normalizedEmail,
                  password,
                });
              }
            }
          }

          return this.teacherRepo.create({
            teacherCode: row.teacherCode,
            fullName: row.fullName,
            departmentId: resolvedKeys.departmentId,
            academicRank: row.academicRank || "",
            academicDegree: row.academicDegree || "",
            phone: row.phone,
            accountId,
          });
        },

        batchSize: 500,
      },
    );

    if (generatedPasswords.length > 0) {
      result.generatedPasswords = generatedPasswords;
    }

    return result;
  }
}
