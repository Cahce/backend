import { z } from "zod";
import type { FacultyRepo } from "../../domain/Faculty/Ports.js";
import type { DepartmentRepo } from "../../domain/Department/Ports.js";
import type { Department } from "../../domain/Department/Types.js";
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
 * Import departments from CSV / XLSX. Application use case — depends only on
 * the FacultyRepo + DepartmentRepo domain ports, never on Prisma.
 */
export class ImportDepartments {
  constructor(
    private readonly facultyRepo: FacultyRepo,
    private readonly departmentRepo: DepartmentRepo,
  ) {}

  async execute(rows: unknown[]): Promise<ImportResult> {
    const normalized = rows.map((row) =>
      normalizeRow(row as Record<string, unknown>, DEPARTMENT_HEADER_MAP),
    );
    return ImportService.runImport<DepartmentImportRow, Department>(
      normalized as DepartmentImportRow[],
      {
        validateRow: async (row) => {
          try {
            DepartmentImportRowSchema.parse(row);
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
          const faculty = await this.facultyRepo.findByCode(row.facultyCode);
          if (!faculty) {
            throw new Error(`Không tìm thấy khoa với mã "${row.facultyCode}"`);
          }
          return { facultyId: faculty.id };
        },

        checkExists: async (row) => {
          const existing = await this.departmentRepo.findByCode(row.code);
          return existing !== null;
        },

        createEntity: async (row, resolvedKeys) => {
          if (!resolvedKeys?.facultyId) {
            throw new Error("Faculty ID not resolved");
          }
          return this.departmentRepo.create({
            code: row.code,
            name: row.name,
            facultyId: resolvedKeys.facultyId,
          });
        },

        batchSize: 500,
      },
    );
  }
}
