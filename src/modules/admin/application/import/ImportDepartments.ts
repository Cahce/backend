import { z } from "zod";
import type { PrismaClient } from "../../../../generated/prisma/index.js";
import { ImportService, type ImportResult } from "./ImportTypes.js";
import { normalizeRow, type HeaderMap } from "./HeaderMap.js";

/**
 * Department import row schema
 */
const DepartmentImportRowSchema = z.object({
  code: z.string().min(1, "Mã bộ môn không được để trống"),
  name: z.string().min(1, "Tên bộ môn không được để trống"),
  facultyCode: z.string().min(1, "Mã khoa không được để trống"),
});

type DepartmentImportRow = z.infer<typeof DepartmentImportRowSchema>;

/**
 * Matches columns in "Mẫu Import Bộ môn V2.xlsx" (STT ignored).
 */
const DEPARTMENT_HEADER_MAP: HeaderMap = {
  "Mã Bộ Môn": "code",
  "Bộ Môn": "name",
  Khoa: "facultyCode",
};

/**
 * Import departments from CSV
 */
export class ImportDepartments {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(rows: unknown[]): Promise<ImportResult> {
    const normalized = rows.map((row) =>
      normalizeRow(row as Record<string, unknown>, DEPARTMENT_HEADER_MAP),
    );
    return ImportService.runImport<DepartmentImportRow, any>(
      normalized as DepartmentImportRow[],
      {
        validateRow: async (row, _rowIndex) => {
          try {
            DepartmentImportRowSchema.parse(row);
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
          const existing = await this.prisma.department.findUnique({
            where: { code: row.code },
          });
          return existing !== null;
        },

        createEntity: async (row, resolvedKeys) => {
          if (!resolvedKeys?.facultyId) {
            throw new Error("Faculty ID not resolved");
          }

          return this.prisma.department.create({
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
