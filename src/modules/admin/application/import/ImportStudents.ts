import { z } from "zod";
import bcrypt from "bcrypt";
import type { PrismaClient } from "../../../../generated/prisma/index.js";
import { ImportService, type ImportResult, type GeneratedPassword } from "./ImportTypes.js";
import { EnvEmailPolicy } from "../../domain/AccountManagement/Policies.js";
import {
  normalizeRow,
  parseImportDate,
  parseImportGender,
  type HeaderMap,
} from "./HeaderMap.js";

/**
 * Student import row schema
 */
const StudentImportRowSchema = z.object({
  studentCode: z.string().min(1, "Mã sinh viên không được để trống"),
  fullName: z.string().min(1, "Tên sinh viên không được để trống"),
  classCode: z.string().min(1, "Mã lớp không được để trống"),
  phone: z.string().optional(),
  // Kept loose; normalized via parseImportGender / parseImportDate at create time.
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
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
  "Ngày sinh": "dateOfBirth",
  "Giới tính": "gender",
  "Số điện thoại": "phone",
  "Lớp": "classCode",
  "Địa chỉ": "address",
  Email: "accountEmail",
  "Mật Khẩu": "accountPassword",
};

/**
 * Import students from CSV with optional account creation
 */
export class ImportStudents {
  private readonly emailPolicy = new EnvEmailPolicy();

  constructor(private readonly prisma: PrismaClient) {}

  async execute(rows: unknown[]): Promise<ImportResult> {
    const generatedPasswords: GeneratedPassword[] = [];

    const normalized = rows.map((row) =>
      normalizeRow(row as Record<string, unknown>, STUDENT_HEADER_MAP),
    );

    const result = await ImportService.runImport<StudentImportRow, any>(
      normalized as StudentImportRow[],
      {
        validateRow: async (row, _rowIndex) => {
          try {
            StudentImportRowSchema.parse(row);

            // Validate email if provided
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
          // Resolve classCode to classId
          const classEntity = await this.prisma.class.findUnique({
            where: { code: row.classCode },
            select: { id: true },
          });

          if (!classEntity) {
            throw new Error(`Không tìm thấy lớp với mã "${row.classCode}"`);
          }

          return {
            classId: classEntity.id,
          };
        },

        checkExists: async (row) => {
          const existing = await this.prisma.student.findUnique({
            where: { studentCode: row.studentCode },
          });
          return existing !== null;
        },

        createEntity: async (row, resolvedKeys) => {
          if (!resolvedKeys?.classId) {
            throw new Error("Class ID not resolved");
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
              // Check if account is already linked to another student
              const linkedStudent = await this.prisma.student.findUnique({
                where: { accountId: existingAccount.id },
              });

              if (linkedStudent) {
                throw new Error(
                  `Email "${row.accountEmail}" đã được liên kết với sinh viên khác`
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
                  role: "student",
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

          // Create student
          const dob = parseImportDate(row.dateOfBirth);
          return this.prisma.student.create({
            data: {
              studentCode: row.studentCode,
              fullName: row.fullName,
              classId: resolvedKeys.classId,
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
