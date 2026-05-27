import { z } from "zod";
import bcrypt from "bcrypt";
import type { PrismaClient, UserRole } from "../../../../generated/prisma/index.js";
import { ImportService, type ImportResult, type GeneratedPassword } from "./ImportTypes.js";
import { EnvEmailPolicy } from "../../domain/AccountManagement/Policies.js";
import { normalizeRow, type HeaderMap } from "./HeaderMap.js";

/**
 * Account import row schema
 */
const AccountImportRowSchema = z.object({
  email: z.string().min(1, "Email không được để trống"),
  password: z.string().optional(),
  role: z.enum(["admin", "teacher", "student"]).refine(
    (val) => ["admin", "teacher", "student"].includes(val),
    { message: "Vai trò phải là admin, teacher hoặc student" }
  ),
  isActive: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === "1" || val === undefined),
  linkType: z.enum(["teacher", "student"]).optional(),
  linkCode: z.string().optional(),
});

type AccountImportRow = z.infer<typeof AccountImportRowSchema>;

/**
 * Vietnamese headers for the downloadable accounts template.
 */
const ACCOUNT_HEADER_MAP: HeaderMap = {
  Email: "email",
  "Mật Khẩu": "password",
  "Vai trò": "role",
  "Kích hoạt": "isActive",
  "Loại liên kết": "linkType",
  "Mã liên kết": "linkCode",
};

/**
 * Import accounts from CSV with optional linking to teacher/student
 */
export class ImportAccounts {
  private readonly emailPolicy = new EnvEmailPolicy();

  constructor(private readonly prisma: PrismaClient) {}

  async execute(rows: unknown[]): Promise<ImportResult> {
    const generatedPasswords: GeneratedPassword[] = [];

    const normalized = rows.map((row) =>
      normalizeRow(row as Record<string, unknown>, ACCOUNT_HEADER_MAP),
    );

    const result = await ImportService.runImport<AccountImportRow, any>(
      normalized as AccountImportRow[],
      {
        validateRow: async (row, _rowIndex) => {
          try {
            const parsed = AccountImportRowSchema.parse(row);

            // Validate email for role
            const emailValidation = this.emailPolicy.validate(parsed.email, parsed.role);
            if (!emailValidation.ok) {
              return {
                ok: false,
                code: emailValidation.code,
                message: emailValidation.message,
              };
            }

            // Validate linkType and linkCode consistency
            if (parsed.linkType && !parsed.linkCode) {
              return {
                ok: false,
                code: "VALIDATION_ERROR",
                message: "linkCode là bắt buộc khi có linkType",
              };
            }

            if (parsed.linkCode && !parsed.linkType) {
              return {
                ok: false,
                code: "VALIDATION_ERROR",
                message: "linkType là bắt buộc khi có linkCode",
              };
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
          const parsed = AccountImportRowSchema.parse(row);

          // Resolve linkCode to entity ID if provided
          if (parsed.linkType && parsed.linkCode) {
            if (parsed.linkType === "teacher") {
              const teacher = await this.prisma.teacher.findUnique({
                where: { teacherCode: parsed.linkCode },
                select: { id: true, accountId: true },
              });

              if (!teacher) {
                throw new Error(`Không tìm thấy giảng viên với mã "${parsed.linkCode}"`);
              }

              if (teacher.accountId) {
                throw new Error(
                  `Giảng viên "${parsed.linkCode}" đã được liên kết với tài khoản khác`
                );
              }

              return { linkEntityId: teacher.id };
            } else if (parsed.linkType === "student") {
              const student = await this.prisma.student.findUnique({
                where: { studentCode: parsed.linkCode },
                select: { id: true, accountId: true },
              });

              if (!student) {
                throw new Error(`Không tìm thấy sinh viên với mã "${parsed.linkCode}"`);
              }

              if (student.accountId) {
                throw new Error(
                  `Sinh viên "${parsed.linkCode}" đã được liên kết với tài khoản khác`
                );
              }

              return { linkEntityId: student.id };
            }
          }

          return { linkEntityId: "" };
        },

        checkExists: async (row) => {
          const parsed = AccountImportRowSchema.parse(row);
          const normalizedEmail = EnvEmailPolicy.normalize(parsed.email);

          const existing = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
          });
          return existing !== null;
        },

        createEntity: async (row, resolvedKeys) => {
          const parsed = AccountImportRowSchema.parse(row);
          const normalizedEmail = EnvEmailPolicy.normalize(parsed.email);

          // Generate or use provided password
          let password = parsed.password;
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
              role: parsed.role as UserRole,
              isActive: parsed.isActive !== false,
            },
          });

          // Link to teacher or student if specified
          if (parsed.linkType && resolvedKeys?.linkEntityId && resolvedKeys.linkEntityId !== "") {
            if (parsed.linkType === "teacher") {
              await this.prisma.teacher.update({
                where: { id: resolvedKeys.linkEntityId },
                data: { accountId: account.id },
              });
            } else if (parsed.linkType === "student") {
              await this.prisma.student.update({
                where: { id: resolvedKeys.linkEntityId },
                data: { accountId: account.id },
              });
            }
          }

          // Track generated password
          if (isGenerated) {
            generatedPasswords.push({
              row: 0, // Will be set by caller
              email: normalizedEmail,
              password,
            });
          }

          return account;
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
