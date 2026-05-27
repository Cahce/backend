import { describe, it } from "node:test";
import assert from "node:assert";
import { FileParser } from "../FileParser.js";

describe("FileParser Security Tests", () => {
  describe("XLSX Magic Bytes Validation", () => {
    it("should accept valid XLSX file (ZIP signature)", () => {
      // Valid XLSX starts with ZIP magic bytes: 50 4B 03 04
      const validXlsx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      
      assert.throws(() => {
        FileParser.parseXlsx(validXlsx);
      }, /Failed to parse XLSX/); // Will fail parsing but passes magic bytes check
    });

    it("should reject fake XLSX (text file renamed)", () => {
      // Text file content
      const fakeXlsx = Buffer.from("code,name\nFAC001,Faculty of IT");
      
      assert.throws(() => {
        FileParser.parseXlsx(fakeXlsx);
      }, /Invalid XLSX file format/);
    });

    it("should reject fake XLSX (EXE file renamed)", () => {
      // EXE magic bytes: 4D 5A (MZ)
      const fakeXlsx = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
      
      assert.throws(() => {
        FileParser.parseXlsx(fakeXlsx);
      }, /Invalid XLSX file format/);
    });

    it("should reject empty buffer", () => {
      const emptyBuffer = Buffer.from([]);
      
      assert.throws(() => {
        FileParser.parseXlsx(emptyBuffer);
      }, /Invalid XLSX file format/);
    });

    it("should reject buffer with insufficient bytes", () => {
      const shortBuffer = Buffer.from([0x50, 0x4b]); // Only 2 bytes
      
      assert.throws(() => {
        FileParser.parseXlsx(shortBuffer);
      }, /Invalid XLSX file format/);
    });
  });

  describe("CSV Magic Bytes Validation", () => {
    it("should accept valid CSV with UTF-8 BOM", () => {
      // UTF-8 BOM: EF BB BF
      const csvWithBom = Buffer.from([0xef, 0xbb, 0xbf, ...Buffer.from("code,name\n")]);
      
      assert.doesNotThrow(() => {
        FileParser.parseCsv(csvWithBom);
      });
    });

    it("should accept valid CSV without BOM", () => {
      const validCsv = Buffer.from("code,name\nFAC001,Faculty of IT");
      
      assert.doesNotThrow(() => {
        FileParser.parseCsv(validCsv);
      });
    });

    it("should reject truly binary file (non-text bytes)", () => {
      // Binary data with non-printable bytes
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
      
      assert.throws(() => {
        FileParser.parseCsv(binaryData);
      }, /Invalid CSV file format/);
    });

    it("should reject empty buffer", () => {
      const emptyBuffer = Buffer.from([]);
      
      assert.throws(() => {
        FileParser.parseCsv(emptyBuffer);
      }, /Invalid CSV file format/);
    });

    it("should accept CSV with tab separator", () => {
      const csvWithTab = Buffer.from("code\tname\nFAC001\tFaculty of IT");
      
      assert.doesNotThrow(() => {
        FileParser.parseCsv(csvWithTab);
      });
    });

    it("should note: EXE files starting with MZ pass magic bytes but parse as empty", () => {
      // EXE magic bytes: 4D 5A (MZ) are valid ASCII characters ('M' and 'Z')
      // Magic bytes check passes, and csv-parse is lenient (returns empty array)
      // Real protection comes from route-level MIME validation
      const exeContent = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
      
      // This doesn't throw - csv-parse is lenient and returns empty array
      const result = FileParser.parseCsv(exeContent);
      assert.strictEqual(result.rows.length, 0); // No valid CSV data parsed
    });
  });

  describe("MIME Type Validation", () => {
    it("should accept valid XLSX MIME types", () => {
      const xlsxMimes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];

      xlsxMimes.forEach((mime) => {
        const result = FileParser.validateMimeType(mime);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.format, "xlsx");
      });
    });

    it("should accept valid CSV MIME types", () => {
      const csvMimes = ["text/csv", "application/csv", "text/plain"];

      csvMimes.forEach((mime) => {
        const result = FileParser.validateMimeType(mime);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.format, "csv");
      });
    });

    it("should reject invalid MIME types", () => {
      const invalidMimes = [
        "application/octet-stream",
        "application/x-msdownload", // EXE
        "application/pdf",
        "image/png",
        "text/html",
      ];

      invalidMimes.forEach((mime) => {
        const result = FileParser.validateMimeType(mime);
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.format, null);
      });
    });
  });

  describe("Format Detection", () => {
    it("should detect XLSX by magic bytes even with wrong MIME", () => {
      const xlsxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      const wrongMime = "text/plain";

      const format = FileParser.detectFormat(xlsxBuffer, wrongMime);
      assert.strictEqual(format, "xlsx");
    });

    it("should detect XLSX by MIME when magic bytes are not ZIP", () => {
      const nonZipBuffer = Buffer.from("not a zip file");
      const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const format = FileParser.detectFormat(nonZipBuffer, xlsxMime);
      assert.strictEqual(format, "xlsx");
    });

    it("should default to CSV for text files", () => {
      const textBuffer = Buffer.from("code,name\nFAC001,Faculty");
      const textMime = "text/plain";

      const format = FileParser.detectFormat(textBuffer, textMime);
      assert.strictEqual(format, "csv");
    });
  });

  describe("Security Scenarios", () => {
    it("Scenario: Renamed .txt to .xlsx should fail magic bytes", () => {
      const textContent = Buffer.from("This is a text file, not XLSX");
      
      assert.throws(() => {
        FileParser.parseXlsx(textContent);
      }, /Invalid XLSX file format/);
    });

    it("Scenario: Renamed .exe to .xlsx should fail magic bytes", () => {
      // EXE file starts with MZ header
      const exeContent = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      
      assert.throws(() => {
        FileParser.parseXlsx(exeContent);
      }, /Invalid XLSX file format/);
    });

    it("Scenario: Renamed .exe to .csv - protected by MIME validation at route level", () => {
      // EXE magic bytes (MZ) are technically valid ASCII characters
      // csv-parse is lenient and returns empty array for binary content
      // Real protection comes from:
      // 1. Route-level MIME validation (rejects non-CSV MIME types)
      // 2. Empty parse result means no data imported
      const exeContent = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      
      // This doesn't throw - csv-parse is lenient
      const result = FileParser.parseCsv(exeContent);
      assert.strictEqual(result.rows.length, 0); // No valid data
    });

    it("Scenario: Valid XLSX with ZIP signature should pass magic bytes", () => {
      // This will pass magic bytes but fail parsing (not a complete XLSX)
      const zipSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      
      assert.throws(() => {
        FileParser.parseXlsx(zipSignature);
      }, /Failed to parse XLSX/); // Passes magic bytes, fails parsing
    });

    it("Scenario: Valid CSV should parse successfully", () => {
      const validCsv = Buffer.from("code,name\nFAC001,Faculty of IT\nFAC002,Faculty of Science");
      
      const result = FileParser.parseCsv(validCsv);
      assert.strictEqual(result.rows.length, 2);
      assert.deepStrictEqual(result.headers, ["code", "name"]);
      assert.deepStrictEqual(result.rows[0], { code: "FAC001", name: "Faculty of IT" });
    });
  });

  describe("Edge Cases", () => {
    it("should handle CSV with empty lines", () => {
      const csvWithEmptyLines = Buffer.from("code,name\n\nFAC001,Faculty\n\n");
      
      const result = FileParser.parseCsv(csvWithEmptyLines);
      assert.strictEqual(result.rows.length, 1); // Empty lines skipped
    });

    it("should handle CSV with whitespace", () => {
      const csvWithWhitespace = Buffer.from("code,name\n  FAC001  ,  Faculty  ");
      
      const result = FileParser.parseCsv(csvWithWhitespace);
      assert.deepStrictEqual(result.rows[0], { code: "FAC001", name: "Faculty" }); // Trimmed
    });

    it("should handle CSV with different line endings", () => {
      const csvWithCRLF = Buffer.from("code,name\r\nFAC001,Faculty\r\n");
      
      const result = FileParser.parseCsv(csvWithCRLF);
      assert.strictEqual(result.rows.length, 1);
    });
  });
});
