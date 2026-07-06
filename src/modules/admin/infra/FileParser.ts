import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

export interface ParsedFile<T> {
  rows: T[];
  headers: string[];
}

export type FileFormat = "csv" | "xlsx";

export class FileParser {
  static parseXlsx<T = Record<string, string>>(buffer: Buffer): ParsedFile<T> {
    const isValidXlsx = this.validateXlsxMagicBytes(buffer);
    if (!isValidXlsx) {
      throw new Error("Invalid XLSX file format");
    }

    try {
      const workbook = XLSX.read(buffer, { type: "buffer" });

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("XLSX file has no worksheets");
      }

      const worksheet = workbook.Sheets[firstSheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: "",
      }) as T[];

      const headers = jsonData.length > 0 ? Object.keys(jsonData[0] as any) : [];

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

  static parseCsv<T = Record<string, string>>(buffer: Buffer): ParsedFile<T> {
    const isValidCsv = this.validateCsvMagicBytes(buffer);
    if (!isValidCsv) {
      throw new Error("Invalid CSV file format");
    }

    try {
      const records = parse(buffer, {
        columns: true,
        trim: true,
        skip_empty_lines: true,
        bom: true,
        relaxColumnCount: true,
      }) as T[];

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

  static detectFormat(buffer: Buffer, mimetype: string): FileFormat {
    if (this.validateXlsxMagicBytes(buffer)) {
      return "xlsx";
    }

    const xlsxMimes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    if (xlsxMimes.includes(mimetype)) {
      return "xlsx";
    }

    return "csv";
  }

  static buildXlsxTemplate(
    headers: string[],
    exampleRow: Record<string, string>
  ): Buffer {
    const workbook = XLSX.utils.book_new();

    const data = [
      headers,
      headers.map((header) => exampleRow[header] || ""),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    return buffer as Buffer;
  }

  static buildCsvTemplate(
    headers: string[],
    exampleRow: Record<string, string>
  ): string {
    const bom = "\uFEFF";

    const headerLine = headers.join(",");

    const exampleLine = headers.map((header) => exampleRow[header] || "").join(",");

    return `${bom}${headerLine}\n${exampleLine}\n`;
  }

  private static validateXlsxMagicBytes(buffer: Buffer): boolean {
    if (buffer.length < 4) {
      return false;
    }

    return (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    );
  }

  private static validateCsvMagicBytes(buffer: Buffer): boolean {
    if (buffer.length === 0) {
      return false;
    }

    if (
      buffer.length >= 3 &&
      buffer[0] === 0xef &&
      buffer[1] === 0xbb &&
      buffer[2] === 0xbf
    ) {
      return true;
    }

    const firstByte = buffer[0];
    return (
      (firstByte >= 0x20 && firstByte <= 0x7e) ||
      firstByte === 0x09 ||
      firstByte === 0x0a ||
      firstByte === 0x0d
    );
  }

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
