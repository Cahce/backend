import { z } from "zod";
import type { PrismaClient } from "../../../../generated/prisma/index.js";
import { ImportService, type ImportResult } from "./ImportTypes.js";
import { normalizeRow, type HeaderMap } from "./HeaderMap.js";

/**
 * Class import row schema
 */
const ClassImportRowSchema = z.object({
  code: z.string().min(1, "Mã lớp không được để trống"),
  name: z.string().min(1, "Tên lớp không được để trống"),
  majorCode: z.string().min(1, "Mã ngành không được để trống"),
});

type ClassImportRow = z.infer<typeof ClassImportRowSchema>;

/**
 * Matches columns in "Mẫu Import Lớp V2.xlsx" (STT ignored).
 */
const CLASS_HEADER_MAP: HeaderMap = {
  "Mã Lớp": "code",
  "Lớp": "name",
  "Ngành": "majorCode",
};

/**
 * Import classes from CSV
 */
export class ImportClasses {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(rows: unknown[]): Promise<ImportResult> {
    const normalized = rows.map((row) =>
      normalizeRow(row as Record<string, unknown>, CLASS_HEADER_MAP),
    );
    return ImportService.runImport<ClassImportRow, any>(
      normalized as ClassImportRow[],
      {
        validateRow: async (row, _rowIndex) => {
          try {
            ClassImportRowSchema.parse(row);
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
          // Resolve majorCode to majorId
          const major = await this.prisma.major.findUnique({
            where: { code: row.majorCode },
            select: { id: true },
          });

          if (!major) {
            throw new Error(`Không tìm thấy ngành với mã "${row.majorCode}"`);
          }

          return {
            majorId: major.id,
          };
        },

        checkExists: async (row) => {
          const existing = await this.prisma.class.findUnique({
            where: { code: row.code },
          });
          return existing !== null;
        },

        createEntity: async (row, resolvedKeys) => {
          if (!resolvedKeys?.majorId) {
            throw new Error("Major ID not resolved");
          }

          return this.prisma.class.create({
            data: {
              code: row.code,
              name: row.name,
              majorId: resolvedKeys.majorId,
            },
          });
        },

        batchSize: 500,
      }
    );
  }
}
