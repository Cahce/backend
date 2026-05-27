import { describe, it } from "node:test";
import assert from "node:assert";
import { ImportService } from "../ImportTypes.js";

describe("ImportService", () => {
  describe("runImport", () => {
    it("should import all valid rows", async () => {
      const rows = [
        { code: "FAC001", name: "Faculty 1" },
        { code: "FAC002", name: "Faculty 2" },
      ];

      const created: any[] = [];

      const result = await ImportService.runImport(rows, {
        validateRow: async () => ({ ok: true }),
        checkExists: async () => false,
        createEntity: async (row) => {
          created.push(row);
          return row;
        },
      });

      assert.strictEqual(result.total, 2);
      assert.strictEqual(result.created, 2);
      assert.strictEqual(result.skipped, 0);
      assert.strictEqual(result.failed, 0);
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(created.length, 2);
    });

    it("should skip existing rows", async () => {
      const rows = [
        { code: "FAC001", name: "Faculty 1" },
        { code: "FAC002", name: "Faculty 2" },
      ];

      const result = await ImportService.runImport(rows, {
        validateRow: async () => ({ ok: true }),
        checkExists: async (row: any) => row.code === "FAC001",
        createEntity: async (row) => row,
      });

      assert.strictEqual(result.total, 2);
      assert.strictEqual(result.created, 1);
      assert.strictEqual(result.skipped, 1);
      assert.strictEqual(result.failed, 0);
    });

    it("should collect validation errors", async () => {
      const rows = [
        { code: "", name: "Faculty 1" },
        { code: "FAC002", name: "" },
      ];

      const result = await ImportService.runImport(rows, {
        validateRow: async (row: any) => {
          if (!row.code) {
            return {
              ok: false,
              code: "MISSING_CODE",
              message: "Thiếu mã",
            };
          }
          if (!row.name) {
            return {
              ok: false,
              code: "MISSING_NAME",
              message: "Thiếu tên",
            };
          }
          return { ok: true };
        },
        checkExists: async () => false,
        createEntity: async (row) => row,
      });

      assert.strictEqual(result.total, 2);
      assert.strictEqual(result.created, 0);
      assert.strictEqual(result.skipped, 0);
      assert.strictEqual(result.failed, 2);
      assert.strictEqual(result.errors.length, 2);
      assert.strictEqual(result.errors[0].row, 1);
      assert.strictEqual(result.errors[0].code, "MISSING_CODE");
      assert.strictEqual(result.errors[1].row, 2);
      assert.strictEqual(result.errors[1].code, "MISSING_NAME");
    });

    it("should handle foreign key resolution", async () => {
      const rows = [{ code: "DEP001", name: "Department 1", facultyCode: "FAC001" }];

      const created: any[] = [];

      const result = await ImportService.runImport(rows, {
        validateRow: async () => ({ ok: true }),
        resolveForeignKeys: async (_row: any) => ({
          facultyId: "faculty-id-1",
        }),
        checkExists: async () => false,
        createEntity: async (row, resolvedKeys) => {
          created.push({ ...row, ...resolvedKeys });
          return row;
        },
      });

      assert.strictEqual(result.created, 1);
      assert.strictEqual(created[0].facultyId, "faculty-id-1");
    });

    it("should handle foreign key resolution errors", async () => {
      const rows = [{ code: "DEP001", name: "Department 1", facultyCode: "INVALID" }];

      const result = await ImportService.runImport(rows, {
        validateRow: async () => ({ ok: true }),
        resolveForeignKeys: async () => {
          throw new Error("Faculty not found");
        },
        checkExists: async () => false,
        createEntity: async (row) => row,
      });

      assert.strictEqual(result.failed, 1);
      assert.strictEqual(result.errors[0].code, "FOREIGN_KEY_ERROR");
    });

    it("should process in batches", async () => {
      const rows = Array.from({ length: 1500 }, (_, i) => ({
        code: `FAC${i.toString().padStart(3, "0")}`,
        name: `Faculty ${i}`,
      }));

      const result = await ImportService.runImport(rows, {
        validateRow: async () => ({ ok: true }),
        checkExists: async () => false,
        createEntity: async (row) => row,
        batchSize: 500,
      });

      assert.strictEqual(result.total, 1500);
      assert.strictEqual(result.created, 1500);
    });
  });

  describe("generatePassword", () => {
    it("should generate password with correct length", () => {
      const password = ImportService.generatePassword(12);
      assert.strictEqual(password.length, 12);
    });

    it("should generate password with at least one lowercase", () => {
      const password = ImportService.generatePassword(12);
      assert.ok(/[a-z]/.test(password));
    });

    it("should generate password with at least one uppercase", () => {
      const password = ImportService.generatePassword(12);
      assert.ok(/[A-Z]/.test(password));
    });

    it("should generate password with at least one number", () => {
      const password = ImportService.generatePassword(12);
      assert.ok(/[0-9]/.test(password));
    });

    it("should generate password with at least one special character", () => {
      const password = ImportService.generatePassword(12);
      assert.ok(/[!@#$]/.test(password));
    });

    it("should generate different passwords", () => {
      const password1 = ImportService.generatePassword(12);
      const password2 = ImportService.generatePassword(12);
      assert.notStrictEqual(password1, password2);
    });
  });
});
