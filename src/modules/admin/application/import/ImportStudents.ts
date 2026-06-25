import { z } from "zod";
import type { ClassRepo } from "../../domain/Class/Ports.js";
import type { AdminAccountRepo } from "../../domain/AccountManagement/Ports.js";
import type { StudentProfileRepo } from "../../domain/StudentManagement/Ports.js";
import type { StudentProfile } from "../../domain/StudentManagement/Types.js";
import type { PasswordHasher } from "../../domain/shared/PasswordHasher.js";
import { ImportService, type ImportResult, type GeneratedPassword } from "./ImportTypes.js";
import { EnvEmailPolicy } from "../../domain/AccountManagement/Policies.js";
import { normalizeRow, type HeaderMap } from "./HeaderMap.js";

/**
 * Student import row schema
 */
const StudentImportRowSchema = z.object({
  studentCode: z.string().min(1, "Mã sinh viên không được để trống"),
  fullName: z.string().min(1, "Tên sinh viên không được để trống"),
  classCode: z.string().min(1, "Mã lớp không được để trống"),
  phone: z.string().optional(),
  accountEmail: z.string().optional(),
  accountPassword: z.string().optional(),
});

type StudentImportRow = z.infer<typeof StudentImportRowSchema>;

/**
 * Matches columns in "Mẫu Import Sinh viên.xlsx" (STT ignored).
 */
const STUDENT_HEADER_MAP: HeaderMap = {
  "Mã sinh viên": "studentCode",
  "Họ và Tên": "fullName",
  "Lớp": "classCode",
  Email: "accountEmail",
  "Mật Khẩu": "accountPassword",
  "Số điện thoại": "phone",
};

/**
 * Import students from CSV with optional account creation.
 *
 * Application use case — depends only on domain ports (class/account/student
 * repos + PasswordHasher), never on Prisma or bcrypt directly.
 */
export class ImportStudents {
  private readonly emailPolicy = new EnvEmailPolicy();

  constructor(
    private readonly classRepo: ClassRepo,
    private readonly accountRepo: AdminAccountRepo,
    private readonly studentRepo: StudentProfileRepo,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(rows: unknown[]): Promise<ImportResult> {
    const generatedPasswords: GeneratedPassword[] = [];

    const normalized = rows.map((row) =>
      normalizeRow(row as Record<string, unknown>, STUDENT_HEADER_MAP),
    );

    const result = await ImportService.runImport<StudentImportRow, StudentProfile>(
      normalized as StudentImportRow[],
      {
        validateRow: async (row) => {
          try {
            StudentImportRowSchema.parse(row);

            if (row.accountEmail) {
              const emailValidation = this.emailPolicy.validate(row.accountEmail, "student");
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
          const classEntity = await this.classRepo.findByCode(row.classCode);
          if (!classEntity) {
            throw new Error(`Không tìm thấy lớp với mã "${row.classCode}"`);
          }
          return { classId: classEntity.id };
        },

        checkExists: async (row) => {
          const existing = await this.studentRepo.findByStudentCode(row.studentCode);
          return existing !== null;
        },

        createEntity: async (row, resolvedKeys) => {
          if (!resolvedKeys?.classId) {
            throw new Error("Class ID not resolved");
          }

          // Handle optional account creation / linking.
          let accountId: string | undefined;

          if (row.accountEmail) {
            const normalizedEmail = EnvEmailPolicy.normalize(row.accountEmail);
            const existingAccount = await this.accountRepo.findByEmail(normalizedEmail);

            if (existingAccount) {
              const linkedStudent = await this.studentRepo.findByAccountId(existingAccount.id);
              if (linkedStudent) {
                throw new Error(
                  `Email "${row.accountEmail}" đã được liên kết với sinh viên khác`,
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
                role: "student",
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

          return this.studentRepo.create({
            studentCode: row.studentCode,
            fullName: row.fullName,
            classId: resolvedKeys.classId,
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
