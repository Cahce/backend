export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
  generatedPasswords?: GeneratedPassword[];
}

export interface ImportError {
  row: number;
  code: string;
  message: string;
}

export interface GeneratedPassword {
  row: number;
  email: string;
  password: string;
}

export type RowValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export interface ImportOptions<TRow, TEntity> {
  validateRow: (row: TRow, rowIndex: number) => Promise<RowValidationResult>;

  resolveForeignKeys?: (row: TRow) => Promise<Record<string, string>>;

  checkExists: (row: TRow) => Promise<boolean>;

  createEntity: (
    row: TRow,
    resolvedKeys?: Record<string, string>
  ) => Promise<TEntity>;

  batchSize?: number;
}

export class ImportService {
  static async runImport<TRow, TEntity>(
    rows: TRow[],
    options: ImportOptions<TRow, TEntity>
  ): Promise<ImportResult> {
    const {
      validateRow,
      resolveForeignKeys,
      checkExists,
      createEntity,
      batchSize = 500,
    } = options;

    const result: ImportResult = {
      total: rows.length,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, Math.min(i + batchSize, rows.length));
      const batchStartIndex = i;

      try {
        await this.processBatch(
          batch,
          batchStartIndex,
          {
            validateRow,
            resolveForeignKeys,
            checkExists,
            createEntity,
          },
          result
        );
      } catch (error) {
        for (let j = 0; j < batch.length; j++) {
          const rowIndex = batchStartIndex + j + 1;
          result.failed++;
          result.errors.push({
            row: rowIndex,
            code: "BATCH_ERROR",
            message: `Lỗi xử lý batch: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }
    }

    return result;
  }

  private static async processBatch<TRow, TEntity>(
    batch: TRow[],
    batchStartIndex: number,
    handlers: {
      validateRow: (
        row: TRow,
        rowIndex: number
      ) => Promise<RowValidationResult>;
      resolveForeignKeys?: (row: TRow) => Promise<Record<string, string>>;
      checkExists: (row: TRow) => Promise<boolean>;
      createEntity: (
        row: TRow,
        resolvedKeys?: Record<string, string>
      ) => Promise<TEntity>;
    },
    result: ImportResult
  ): Promise<void> {
    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const rowIndex = batchStartIndex + i + 1;

      try {
        const validation = await handlers.validateRow(row, rowIndex);
        if (!validation.ok) {
          result.failed++;
          result.errors.push({
            row: rowIndex,
            code: validation.code,
            message: validation.message,
          });
          continue;
        }

        const exists = await handlers.checkExists(row);
        if (exists) {
          result.skipped++;
          continue;
        }

        let resolvedKeys: Record<string, string> | undefined;
        if (handlers.resolveForeignKeys) {
          try {
            resolvedKeys = await handlers.resolveForeignKeys(row);
          } catch (error) {
            result.failed++;
            result.errors.push({
              row: rowIndex,
              code: "FOREIGN_KEY_ERROR",
              message: `Không tìm thấy dữ liệu liên kết: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
            continue;
          }
        }

        await handlers.createEntity(row, resolvedKeys);
        result.created++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowIndex,
          code: "CREATE_ERROR",
          message: `Lỗi tạo dữ liệu: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }
  }

  static generatePassword(length: number = 12): string {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    let password = "";

    password += this.randomChar("abcdefghijklmnopqrstuvwxyz");
    password += this.randomChar("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    password += this.randomChar("0123456789");
    password += this.randomChar("!@#$");

    for (let i = password.length; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }

  private static randomChar(charset: string): string {
    return charset.charAt(Math.floor(Math.random() * charset.length));
  }
}
