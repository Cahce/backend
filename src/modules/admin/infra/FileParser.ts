import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

/**
 * Parsed file result
 */
export interface ParsedFile<T> {
  rows: T[];
  headers: string[];
}

/**
 * File format type
 */
export type FileFormat = "csv" | "xlsx";

/**
 * File parser for CSV and XLSX files
 */
export class FileParser {
  /**
   * Parse XLSX file (priority format)
   * @param buffer - File buffer
   * @returns Parsed rows and headers
   */
  static parseXlsx<T = Record<string, string>>(buffer: Buffer): ParsedFile<T> {
    // Validate XLSX magic bytes (ZIP signature: 50 4B 03 04)
    const isValidXlsx = this.validateXlsxMagicBytes(buffer);
    if (!isValidXlsx) {
      throw new Error("Invalid XLSX file format");
    }

    try {
      // Read workbook from buffer
      const workbook = XLSX.read(buffer, { type: "buffer" });

      // Get first worksheet
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("XLSX file has no worksheets");
      }

      const worksheet = workbook.Sheets[firstSheetName];

      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false, // Convert all values to strings
        defval: "", // Default value for empty cells
      }) as T[];

      // Extract headers from first row
      const headers = jsonData.length > 0 ? Object.keys(jsonData[0] as any) : [];

      // Trim all string values
      const trimmedRows = jsonData.map((row) => {
        const trimmedRow: any = {};
        for (const [key, value] of Object.entries(row as any)) {
          trimmedRow[key] = typeof value === "string" ? value.trim() : value;
        }
        return trimmedRow as T;
      });

      return {
        rows: trimmedRows,
        headers,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse XLSX: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Parse CSV file (fallback format)
   * @param buffer - File buffer
   * @returns Parsed rows and headers
   */
  static parseCsv<T = Record<string, string>>(buffer: Buffer): ParsedFile<T> {
    // Validate MIME type by checking magic bytes
    // CSV files typically start with text characters
    const isValidCsv = this.validateCsvMagicBytes(buffer);
    if (!isValidCsv) {
      throw new Error("Invalid CSV file format");
    }

    try {
      const records = parse(buffer, {
        columns: true, // Use first row as headers
        trim: true, // Trim whitespace
        skip_empty_lines: true, // Skip empty lines
        bom: true, // Handle UTF-8 BOM
        relaxColumnCount: true, // Allow rows with different column counts
      }) as T[];

      // Extract headers from first row
      const headers = records.length > 0 ? Object.keys(records[0] as any) : [];

      return {
        rows: records,
        headers,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Parse spreadsheet file (auto-detect format)
   * @param buffer - File buffer
   * @param mimetype - MIME type from upload
   * @returns Parsed rows, headers, and detected format
   */
  static parseSpreadsheet<T = Record<string, string>>(
    buffer: Buffer,
    mimetype: string
  ): ParsedFile<T> & { format: FileFormat } {
    const format = this.detectFormat(buffer, mimetype);

    if (format === "xlsx") {
      const parsed = this.parseXlsx<T>(buffer);
      return { ...parsed, format: "xlsx" };
    } else {
      const parsed = this.parseCsv<T>(buffer);
      return { ...parsed, format: "csv" };
    }
  }

  /**
   * Detect file format from buffer and MIME type
   */
  static detectFormat(buffer: Buffer, mimetype: string): FileFormat {
    // Check for XLSX magic bytes first (ZIP signature: 50 4B 03 04)
    if (this.validateXlsxMagicBytes(buffer)) {
      return "xlsx";
    }

    // Check MIME type
    const xlsxMimes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    if (xlsxMimes.includes(mimetype)) {
      return "xlsx";
    }

    // Default to CSV for text-based files
    return "csv";
  }

  /**
   * Build XLSX template
   */
  static buildXlsxTemplate(
    headers: string[],
    exampleRow: Record<string, string>
  ): Buffer {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();

    // Create data array with header and example row
    const data = [
      headers,
      headers.map((header) => exampleRow[header] || ""),
    ];

    // Create worksheet from array
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    // Write to buffer
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return buffer as Buffer;
  }

  /**
   * Build CSV template
   */
  static buildCsvTemplate(
    headers: string[],
    exampleRow: Record<string, string>
  ): string {
    // UTF-8 BOM for Excel compatibility
    const bom = "\uFEFF";

    // Header row
    const headerLine = headers.join(",");

    // Example row
    const exampleLine = headers.map((header) => exampleRow[header] || "").join(",");

    return `${bom}${headerLine}\n${exampleLine}\n`;
  }

  /**
   * Validate XLSX magic bytes (ZIP signature)
   */
  private static validateXlsxMagicBytes(buffer: Buffer): boolean {
    if (buffer.length < 4) {
      return false;
    }

    // Check for ZIP magic bytes: 50 4B 03 04
    return (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    );
  }

  /**
   * Validate CSV magic bytes
   * CSV files are plain text, so we check if the first bytes are valid UTF-8 text
   */
  private static validateCsvMagicBytes(buffer: Buffer): boolean {
    if (buffer.length === 0) {
      return false;
    }

    // Check for UTF-8 BOM (optional)
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xef &&
      buffer[1] === 0xbb &&
      buffer[2] === 0xbf
    ) {
      return true;
    }

    // Check if first bytes are valid ASCII/UTF-8 text characters
    // CSV typically starts with alphanumeric characters or quotes
    const firstByte = buffer[0];
    return (
      (firstByte >= 0x20 && firstByte <= 0x7e) || // Printable ASCII
      firstByte === 0x09 || // Tab
      firstByte === 0x0a || // LF
      firstByte === 0x0d // CR
    );
  }

  /**
   * Validate file MIME type
   */
  static validateMimeType(mimetype: string): {
    valid: boolean;
    format: "csv" | "xlsx" | null;
  } {
    const csvMimes = ["text/csv", "application/csv", "text/plain"];
    const xlsxMimes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    if (csvMimes.includes(mimetype)) {
      return { valid: true, format: "csv" };
    }

    if (xlsxMimes.includes(mimetype)) {
      return { valid: true, format: "xlsx" };
    }

    return { valid: false, format: null };
  }
}
