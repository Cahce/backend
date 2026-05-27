/**
 * Import result for bulk operations
 */
export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
  generatedPasswords?: GeneratedPassword[];
}

/**
 * Import error for a specific row
 */
export interface ImportError {
  row: number;
  code: string;
  message: string;
}

/**
 * Generated password for a row (when password is auto-generated)
 */
export interface GeneratedPassword {
  row: number;
  email: string;
  password: string;
}

/**
 * Import row validation result
 */
export type RowValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * Import options for batch processing
 */
export interface ImportOptions<TRow, TEntity> {
  /**
   * Validate a single row
   */
  validateRow: (row: TRow, rowIndex: number) => Promise<RowValidationResult>;

  /**
   * Resolve foreign keys (e.g., facultyCode -> facultyId)
   */
  resolveForeignKeys?: (row: TRow) => Promise<Record<string, string>>;

  /**
   * Check if entity already exists (for idempotency)
   */
  checkExists: (row: TRow) => Promise<boolean>;

  /**
   * Create entity from row
   */
  createEntity: (
    row: TRow,
    resolvedKeys?: Record<string, string>
  ) => Promise<TEntity>;

  /**
   * Batch size for transaction processing
   */
  batchSize?: number;
}

/**
 * Base import service with common logic
 */
export class ImportService {
  /**
   * Run import with batch processing and error handling
   */
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

    // Process in batches
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
        // Fatal error in batch - mark all rows in batch as failed
        for (let j = 0; j < batch.length; j++) {
          const rowIndex = batchStartIndex + j + 1; // 1-indexed for user display
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

  /**
   * Process a single batch
   */
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
      const rowIndex = batchStartIndex + i + 1; // 1-indexed for user display

      try {
        // Validate row
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

        // Check if already exists (idempotency)
        const exists = await handlers.checkExists(row);
        if (exists) {
          result.skipped++;
          continue;
        }

        // Resolve foreign keys if needed
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

        // Create entity
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

  /**
   * Generate a random password
   */
  static generatePassword(length: number = 12): string {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    let password = "";

    // Ensure at least one of each required character type
    password += this.randomChar("abcdefghijklmnopqrstuvwxyz"); // lowercase
    password += this.randomChar("ABCDEFGHIJKLMNOPQRSTUVWXYZ"); // uppercase
    password += this.randomChar("0123456789"); // number
    password += this.randomChar("!@#$"); // special

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    // Shuffle the password
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }

  private static randomChar(charset: string): string {
    return charset.charAt(Math.floor(Math.random() * charset.length));
  }
}
