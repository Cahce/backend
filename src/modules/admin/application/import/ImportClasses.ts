import { z } from "zod";
import type { MajorRepo } from "../../domain/Major/Ports.js";
import type { ClassRepo } from "../../domain/Class/Ports.js";
import type { Class } from "../../domain/Class/Types.js";
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
 * Import classes from CSV / XLSX. Application use case — depends only on the
 * MajorRepo + ClassRepo domain ports, never on Prisma.
 */
export class ImportClasses {
  constructor(
    private readonly majorRepo: MajorRepo,
    private readonly classRepo: ClassRepo,
  ) {}

  async execute(rows: unknown[]): Promise<ImportResult> {
    const normalized = rows.map((row) =>
      normalizeRow(row as Record<string, unknown>, CLASS_HEADER_MAP),
    );
    return ImportService.runImport<ClassImportRow, Class>(
      normalized as ClassImportRow[],
      {
        validateRow: async (row) => {
          try {
            ClassImportRowSchema.parse(row);
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
          const major = await this.majorRepo.findByCode(row.majorCode);
          if (!major) {
            throw new Error(`Không tìm thấy ngành với mã "${row.majorCode}"`);
          }
          return { majorId: major.id };
        },

        checkExists: async (row) => {
          const existing = await this.classRepo.findByCode(row.code);
          return existing !== null;
        },

        createEntity: async (row, resolvedKeys) => {
          if (!resolvedKeys?.majorId) {
            throw new Error("Major ID not resolved");
          }
          return this.classRepo.create({
            code: row.code,
            name: row.name,
            majorId: resolvedKeys.majorId,
          });
        },

        batchSize: 500,
      },
    );
  }
}
