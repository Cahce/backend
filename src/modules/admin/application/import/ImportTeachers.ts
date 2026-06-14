import { z } from "zod";
import bcrypt from "bcrypt";
import type { PrismaClient } from "../../../../generated/prisma/index.js";
import { ImportService, type ImportResult, type GeneratedPassword } from "./ImportTypes.js";
import { EnvEmailPolicy } from "../../domain/AccountManagement/Policies.js";
import {
  normalizeRow,
  parseImportDate,
  parseImportGender,
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
  // Kept loose; normalized via parseImportGender / parseImportDate at create time.
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
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
  "Ngày sinh": "dateOfBirth",
  "Giới tính": "gender",
  "Học hàm": "academicRank",
  "Học vị": "academicDegree",
  "Bộ Môn": "departmentCode",
  "Số điện thoại": "phone",
  "Địa chỉ": "address",
  Email: "accountEmail",
  "Mật Khẩu": "accountPassword",
};

/**
 * Import teachers from CSV with optional account creation
 */
export class ImportTeachers {
  private readonly emailPolicy = new EnvEmailPolicy();

  constructor(private readonly prisma: PrismaClient) {}

  async execute(rows: unknown[]): Promise<ImportResult> {
    const generatedPasswords: GeneratedPassword[] = [];

    const normalized = rows.map((row) =>
      normalizeRow(row as Record<string, unknown>, TEACHER_HEADER_MAP),
    );

    // Pre-seed a sequential generator from existing teacherCodes so rows that
    // omit "Mã GV" follow the dominant prefix/digit-width pattern in the DB
    // (e.g., {GV001, GV002} → GV003). Reserves any teacherCode already present
    // in the upload so we never collide.
    const existing = await this.prisma.teacher.findMany({
      select: { teacherCode: true },
    });
    const codeGen = new SequentialCodeGenerator(
      existing.map((t) => t.teacherCode),
    );
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

    const result = await ImportService.runImport<TeacherImportRow, any>(
      normalized as TeacherImportRow[],
      {
        validateRow: async (row, _rowIndex) => {
          try {
            TeacherImportRowSchema.parse(row);

            // Validate email if provided
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
              const firstError = error.issues[0];
              return {
                ok: false,
                code: "VALIDATION_ERROR",
                message: firstError.message,
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
          // Resolve departmentCode to departmentId
          const department = await this.prisma.department.findUnique({
            where: { code: row.departmentCode },
            select: { id: true },
          });

          if (!department) {
            throw new Error(`Không tìm thấy bộ môn với mã "${row.departmentCode}"`);
          }

          return {
            departmentId: department.id,
          };
        },

        checkExists: async (row) => {
          const existing = await this.prisma.teacher.findUnique({
            where: { teacherCode: row.teacherCode },
          });
          return existing !== null;
        },

        createEntity: async (row, resolvedKeys) => {
          if (!resolvedKeys?.departmentId) {
            throw new Error("Department ID not resolved");
          }

          // Handle account creation if email is provided
          let accountId: string | undefined;

          if (row.accountEmail) {
            const normalizedEmail = EnvEmailPolicy.normalize(row.accountEmail);

            // Check if account already exists
            const existingAccount = await this.prisma.user.findUnique({
              where: { email: normalizedEmail },
            });

            if (existingAccount) {
              // Check if account is already linked to another teacher
              const linkedTeacher = await this.prisma.teacher.findUnique({
                where: { accountId: existingAccount.id },
              });

              if (linkedTeacher) {
                throw new Error(
                  `Email "${row.accountEmail}" đã được liên kết với giảng viên khác`
                );
              }

              accountId = existingAccount.id;
            } else {
              // Generate or use provided password
              let password = row.accountPassword;
              let isGenerated = false;

              if (!password) {
                password = ImportService.generatePassword();
                isGenerated = true;
              }

              // Hash password
              const hashedPassword = await bcrypt.hash(password, 10);

              // Create account
              const account = await this.prisma.user.create({
                data: {
                  email: normalizedEmail,
                  passwordHash: hashedPassword,
                  role: "teacher",
                  isActive: true,
                },
              });

              accountId = account.id;

              // Track generated password
              if (isGenerated) {
                generatedPasswords.push({
                  row: 0, // Will be set by caller
                  email: normalizedEmail,
                  password,
                });
              }
            }
          }

          // Create teacher
          const dob = parseImportDate(row.dateOfBirth);
          return this.prisma.teacher.create({
            data: {
              teacherCode: row.teacherCode,
              fullName: row.fullName,
              departmentId: resolvedKeys.departmentId,
              academicRank: row.academicRank || "",
              academicDegree: row.academicDegree || "",
              phone: row.phone,
              gender: parseImportGender(row.gender) ?? null,
              dateOfBirth: dob ? new Date(dob) : null,
              address: row.address ?? null,
              accountId,
            },
          });
        },

        batchSize: 500,
      }
    );

    // Add generated passwords to result
    if (generatedPasswords.length > 0) {
      result.generatedPasswords = generatedPasswords;
    }

    return result;
  }
}
