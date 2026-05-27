import { z } from 'zod';
import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import type { Faculty } from '../../domain/Faculty/Types.js';
import { ImportService, type ImportResult } from './ImportTypes.js';
import { normalizeRow, type HeaderMap } from './HeaderMap.js';

/**
 * Faculty import row schema
 */
const FacultyImportRowSchema = z.object({
  code: z.string().min(1, 'Mã khoa không được để trống'),
  name: z.string().min(1, 'Tên khoa không được để trống'),
});

type FacultyImportRow = z.infer<typeof FacultyImportRowSchema>;

/**
 * Vietnamese ↔ internal-key mapping. Matches the columns in
 * "Mẫu Import Khoa.xlsx" (STT is ignored).
 */
const FACULTY_HEADER_MAP: HeaderMap = {
  'Mã khoa': 'code',
  'Tên khoa': 'name',
};

/**
 * Import faculties from CSV / XLSX. Application use case — depends only on
 * the FacultyRepo domain port, never on Prisma.
 */
export class ImportFaculties {
  constructor(private readonly facultyRepo: FacultyRepo) {}

  async execute(rows: unknown[]): Promise<ImportResult> {
    const normalized = rows.map((row) =>
      normalizeRow(row as Record<string, unknown>, FACULTY_HEADER_MAP),
    );
    return ImportService.runImport<FacultyImportRow, Faculty>(
      normalized as FacultyImportRow[],
      {
        validateRow: async (row) => {
          try {
            FacultyImportRowSchema.parse(row);
            return { ok: true };
          } catch (error) {
            if (error instanceof z.ZodError) {
              const firstError = error.issues[0];
              return {
                ok: false,
                code: 'VALIDATION_ERROR',
                message: firstError.message,
              };
            }
            return {
              ok: false,
              code: 'VALIDATION_ERROR',
              message: 'Dữ liệu không hợp lệ',
            };
          }
        },

        checkExists: async (row) => {
          const existing = await this.facultyRepo.findByCode(row.code);
          return existing !== null;
        },

        createEntity: async (row) => {
          return this.facultyRepo.create({
            code: row.code,
            name: row.name,
          });
        },

        batchSize: 500,
      }
    );
  }
}
