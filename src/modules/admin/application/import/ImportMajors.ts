import { z } from "zod";
import type { PrismaClient } from "../../../../generated/prisma/index.js";
import { ImportService, type ImportResult } from "./ImportTypes.js";
import { normalizeRow, type HeaderMap } from "./HeaderMap.js";

/**
 * Major import row schema
 */
const MajorImportRowSchema = z.object({
  code: z.string().min(1, "Mã ngành không được để trống"),
  name: z.string().min(1, "Tên ngành không được để trống"),
  facultyCode: z.string().min(1, "Mã khoa không được để trống"),
});

type MajorImportRow = z.infer<typeof MajorImportRowSchema>;

/**
 * Matches columns in "Mẫu Import Ngành V2.xlsx" (STT ignored).
 */
const MAJOR_HEADER_MAP: HeaderMap = {
  "Mã Ngành": "code",
  "Ngành": "name",
  Khoa: "facultyCode",
};

/**
 * Import majors from CSV
 */
export class ImportMajors {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(rows: unknown[]): Promise<ImportResult> {
    const normalized = rows.map((row) =>
      normalizeRow(row as Record<string, unknown>, MAJOR_HEADER_MAP),
    );
    return ImportService.runImport<MajorImportRow, any>(
      normalized as MajorImportRow[],
      {
        validateRow: async (row, _rowIndex) => {
          try {
            MajorImportRowSchema.parse(row);
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
          // Resolve facultyCode to facultyId
          const faculty = await this.prisma.faculty.findUnique({
            where: { code: row.facultyCode },
            select: { id: true },
          });

          if (!faculty) {
            throw new Error(`Không tìm thấy khoa với mã "${row.facultyCode}"`);
          }

          return {
            facultyId: faculty.id,
          };
        },

        checkExists: async (row) => {
          const existing = await this.prisma.major.findUnique({
            where: { code: row.code },
          });
          return existing !== null;
        },

        createEntity: async (row, resolvedKeys) => {
          if (!resolvedKeys?.facultyId) {
            throw new Error("Faculty ID not resolved");
          }

          return this.prisma.major.create({
            data: {
              code: row.code,
              name: row.name,
              facultyId: resolvedKeys.facultyId,
            },
          });
        },

        batchSize: 500,
      }
    );
  }
}
