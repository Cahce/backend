import { z } from "zod";
import type { FacultyRepo } from "../../domain/Faculty/Ports.js";
import type { MajorRepo } from "../../domain/Major/Ports.js";
import type { Major } from "../../domain/Major/Types.js";
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
 * Import majors from CSV / XLSX. Application use case — depends only on the
 * FacultyRepo + MajorRepo domain ports, never on Prisma.
 */
export class ImportMajors {
  constructor(
    private readonly facultyRepo: FacultyRepo,
    private readonly majorRepo: MajorRepo,
  ) {}

  async execute(rows: unknown[]): Promise<ImportResult> {
    const normalized = rows.map((row) =>
      normalizeRow(row as Record<string, unknown>, MAJOR_HEADER_MAP),
    );
    return ImportService.runImport<MajorImportRow, Major>(
      normalized as MajorImportRow[],
      {
        validateRow: async (row) => {
          try {
            MajorImportRowSchema.parse(row);
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
          const existing = await this.majorRepo.findByCode(row.code);
          return existing !== null;
        },

        createEntity: async (row, resolvedKeys) => {
          if (!resolvedKeys?.facultyId) {
            throw new Error("Faculty ID not resolved");
          }
          return this.majorRepo.create({
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
