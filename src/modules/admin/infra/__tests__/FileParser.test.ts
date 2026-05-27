import { describe, it } from "node:test";
import assert from "node:assert";
import { FileParser } from "../FileParser.js";
import * as XLSX from "xlsx";

describe("FileParser", () => {
  describe("parseXlsx", () => {
    it("should parse valid XLSX file", () => {
      // Create a simple XLSX workbook
      const workbook = XLSX.utils.book_new();
      const data = [
        ["code", "name"],
        ["CNTT", "Khoa Công nghệ Thông tin"],
        ["KTQT", "Khoa Kinh tế Quốc tế"],
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

      // Write to buffer
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

      // Parse
      const result = FileParser.parseXlsx(buffer);

      assert.strictEqual(result.rows.length, 2);
      assert.strictEqual(result.headers.length, 2);
      assert.deepStrictEqual(result.headers, ["code", "name"]);
      assert.strictEqual(result.rows[0].code, "CNTT");
      assert.strictEqual(result.rows[0].name, "Khoa Công nghệ Thông tin");
      assert.strictEqual(result.rows[1].code, "KTQT");
      assert.strictEqual(result.rows[1].name, "Khoa Kinh tế Quốc tế");
    });

    it("should trim whitespace in XLSX cells", () => {
      const workbook = XLSX.utils.book_new();
      const data = [
        ["code", "name"],
        ["  CNTT  ", "  Khoa Công nghệ Thông tin  "],
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
      const result = FileParser.parseXlsx(buffer);

      assert.strictEqual(result.rows[0].code, "CNTT");
      assert.strictEqual(result.rows[0].name, "Khoa Công nghệ Thông tin");
    });

    it("should handle empty cells", () => {
      const workbook = XLSX.utils.book_new();
      const data = [
        ["code", "name"],
        ["CNTT", ""],
        ["", "Khoa Kinh tế"],
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
      const result = FileParser.parseXlsx(buffer);

      assert.strictEqual(result.rows.length, 2);
      assert.strictEqual(result.rows[0].code, "CNTT");
      assert.strictEqual(result.rows[0].name, "");
      assert.strictEqual(result.rows[1].code, "");
      assert.strictEqual(result.rows[1].name, "Khoa Kinh tế");
    });

    it("should reject invalid XLSX magic bytes", () => {
      const invalidBuffer = Buffer.from("This is not an XLSX file");

      assert.throws(
        () => FileParser.parseXlsx(invalidBuffer),
        /Invalid XLSX file format/
      );
    });

    it("should handle Vietnamese characters", () => {
      const workbook = XLSX.utils.book_new();
      const data = [
        ["code", "name"],
        ["CNTT", "Khoa Công nghệ Thông tin"],
        ["KTQT", "Khoa Kinh tế Quốc tế"],
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
      const result = FileParser.parseXlsx(buffer);

      assert.strictEqual(result.rows[0].name, "Khoa Công nghệ Thông tin");
      assert.strictEqual(result.rows[1].name, "Khoa Kinh tế Quốc tế");
    });
  });

  describe("parseCsv", () => {
    it("should parse valid CSV file", () => {
      const csv = "code,name\nCNTT,Khoa Công nghệ Thông tin\nKTQT,Khoa Kinh tế Quốc tế\n";
      const buffer = Buffer.from(csv, "utf-8");

      const result = FileParser.parseCsv(buffer);

      assert.strictEqual(result.rows.length, 2);
      assert.strictEqual(result.headers.length, 2);
      assert.deepStrictEqual(result.headers, ["code", "name"]);
      assert.strictEqual(result.rows[0].code, "CNTT");
      assert.strictEqual(result.rows[0].name, "Khoa Công nghệ Thông tin");
    });

    it("should handle UTF-8 BOM", () => {
      const csv = "\uFEFFcode,name\nCNTT,Khoa Công nghệ Thông tin\n";
      const buffer = Buffer.from(csv, "utf-8");

      const result = FileParser.parseCsv(buffer);

      assert.strictEqual(result.rows.length, 1);
      assert.strictEqual(result.rows[0].code, "CNTT");
    });

    it("should skip empty lines", () => {
      const csv = "code,name\nCNTT,Khoa Công nghệ Thông tin\n\nKTQT,Khoa Kinh tế Quốc tế\n";
      const buffer = Buffer.from(csv, "utf-8");

      const result = FileParser.parseCsv(buffer);

      assert.strictEqual(result.rows.length, 2);
    });

    it("should trim whitespace", () => {
      const csv = "code,name\n  CNTT  ,  Khoa Công nghệ Thông tin  \n";
      const buffer = Buffer.from(csv, "utf-8");

      const result = FileParser.parseCsv(buffer);

      assert.strictEqual(result.rows[0].code, "CNTT");
      assert.strictEqual(result.rows[0].name, "Khoa Công nghệ Thông tin");
    });
  });

  describe("parseSpreadsheet", () => {
    it("should auto-detect XLSX format", () => {
      const workbook = XLSX.utils.book_new();
      const data = [
        ["code", "name"],
        ["CNTT", "Khoa Công nghệ Thông tin"],
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
      const mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const result = FileParser.parseSpreadsheet(buffer, mimetype);

      assert.strictEqual(result.format, "xlsx");
      assert.strictEqual(result.rows.length, 1);
      assert.strictEqual(result.rows[0].code, "CNTT");
    });

    it("should auto-detect CSV format", () => {
      const csv = "code,name\nCNTT,Khoa Công nghệ Thông tin\n";
      const buffer = Buffer.from(csv, "utf-8");
      const mimetype = "text/csv";

      const result = FileParser.parseSpreadsheet(buffer, mimetype);

      assert.strictEqual(result.format, "csv");
      assert.strictEqual(result.rows.length, 1);
      assert.strictEqual(result.rows[0].code, "CNTT");
    });

    it("should detect XLSX by magic bytes even with wrong MIME type", () => {
      const workbook = XLSX.utils.book_new();
      const data = [
        ["code", "name"],
        ["CNTT", "Khoa Công nghệ Thông tin"],
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
      const mimetype = "text/plain"; // Wrong MIME type

      const result = FileParser.parseSpreadsheet(buffer, mimetype);

      assert.strictEqual(result.format, "xlsx");
      assert.strictEqual(result.rows.length, 1);
    });
  });

  describe("buildXlsxTemplate", () => {
    it("should build valid XLSX template", () => {
      const headers = ["code", "name"];
      const exampleRow = {
        code: "CNTT",
        name: "Khoa Công nghệ Thông tin",
      };

      const buffer = FileParser.buildXlsxTemplate(headers, exampleRow);

      // Verify it's a valid XLSX file by parsing it back
      const parsed = FileParser.parseXlsx(buffer);

      assert.strictEqual(parsed.rows.length, 1);
      assert.strictEqual(parsed.rows[0].code, "CNTT");
      assert.strictEqual(parsed.rows[0].name, "Khoa Công nghệ Thông tin");
    });
  });

  describe("buildCsvTemplate", () => {
    it("should build valid CSV template with BOM", () => {
      const headers = ["code", "name"];
      const exampleRow = {
        code: "CNTT",
        name: "Khoa Công nghệ Thông tin",
      };

      const template = FileParser.buildCsvTemplate(headers, exampleRow);

      // Should start with BOM
      assert.strictEqual(template.charCodeAt(0), 0xfeff);

      // Should contain header and example row
      assert.ok(template.includes("code,name"));
      assert.ok(template.includes("CNTT,Khoa Công nghệ Thông tin"));
    });
  });

  describe("validateMimeType", () => {
    it("should validate XLSX MIME types", () => {
      const result1 = FileParser.validateMimeType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      assert.strictEqual(result1.valid, true);
      assert.strictEqual(result1.format, "xlsx");

      const result2 = FileParser.validateMimeType("application/vnd.ms-excel");
      assert.strictEqual(result2.valid, true);
      assert.strictEqual(result2.format, "xlsx");
    });

    it("should validate CSV MIME types", () => {
      const result1 = FileParser.validateMimeType("text/csv");
      assert.strictEqual(result1.valid, true);
      assert.strictEqual(result1.format, "csv");

      const result2 = FileParser.validateMimeType("application/csv");
      assert.strictEqual(result2.valid, true);
      assert.strictEqual(result2.format, "csv");

      const result3 = FileParser.validateMimeType("text/plain");
      assert.strictEqual(result3.valid, true);
      assert.strictEqual(result3.format, "csv");
    });

    it("should reject invalid MIME types", () => {
      const result = FileParser.validateMimeType("application/pdf");
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.format, null);
    });
  });

  describe("detectFormat", () => {
    it("should detect XLSX by magic bytes", () => {
      const workbook = XLSX.utils.book_new();
      const data = [["test"]];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

      const format = FileParser.detectFormat(buffer, "text/plain");
      assert.strictEqual(format, "xlsx");
    });

    it("should detect CSV for text files", () => {
      const buffer = Buffer.from("code,name\nCNTT,Test\n", "utf-8");

      const format = FileParser.detectFormat(buffer, "text/csv");
      assert.strictEqual(format, "csv");
    });
  });
});
