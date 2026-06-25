import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { ImportDepartments } from "../ImportDepartments.js";
import type { FacultyRepo } from "../../../domain/Faculty/Ports.js";
import type { DepartmentRepo } from "../../../domain/Department/Ports.js";

/**
 * Fake FacultyRepo exposing only findByCode (the sole method the importer uses).
 * `findByCode(code)` returns the resolved faculty (needs `.id`) or null.
 */
function makeFacultyRepo(findByCode: (code: string) => unknown): FacultyRepo {
  return {
    findByCode: mock.fn(async (code: string) => findByCode(code)),
  } as unknown as FacultyRepo;
}

/**
 * Fake DepartmentRepo exposing findByCode (existence check) + create.
 * `create(data)` receives `{ code, name, facultyId }` directly (no `.data` wrap).
 */
function makeDepartmentRepo(opts: {
  findByCode?: (code: string) => unknown;
  create?: (data: { code: string; name: string; facultyId: string }) => unknown;
}): DepartmentRepo {
  return {
    findByCode: mock.fn(async (code: string) =>
      opts.findByCode ? opts.findByCode(code) : null,
    ),
    create: mock.fn(async (data: { code: string; name: string; facultyId: string }) =>
      opts.create
        ? opts.create(data)
        : { id: "test-id", ...data, createdAt: new Date(), updatedAt: new Date() },
    ),
  } as unknown as DepartmentRepo;
}

describe("ImportDepartments", () => {
  it("should import valid departments successfully", async () => {
    const useCase = new ImportDepartments(
      makeFacultyRepo((code) =>
        code === "CNTT" ? { id: "faculty-1", code: "CNTT", name: "Khoa CNTT" } : null,
      ),
      makeDepartmentRepo({}),
    );

    const rows = [
      { code: "KHMT", name: "Khoa học Máy tính", facultyCode: "CNTT" },
      { code: "HTTT", name: "Hệ thống Thông tin", facultyCode: "CNTT" },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 2);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.errors.length, 0);
  });

  it("accepts Vietnamese headers from the downloadable template", async () => {
    const useCase = new ImportDepartments(
      makeFacultyRepo((code) => ({ id: "faculty-1", code, name: "Khoa" })),
      makeDepartmentRepo({}),
    );

    const rows = [
      { STT: "1", Khoa: "CNTT", "Mã Bộ Môn": "KTPM", "Bộ Môn": "Kỹ thuật phần mềm" },
      { STT: "2", Khoa: "CNTT", "Mã Bộ Môn": "HTTT", "Bộ Môn": "Hệ thống thông tin" },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 2);
    assert.strictEqual(result.failed, 0);
  });

  it("should skip existing departments", async () => {
    const useCase = new ImportDepartments(
      makeFacultyRepo(() => ({ id: "faculty-1", code: "CNTT", name: "Khoa CNTT" })),
      makeDepartmentRepo({
        findByCode: (code) =>
          code === "KHMT" ? { id: "existing-id", code: "KHMT", name: "Existing" } : null,
      }),
    );

    const rows = [
      { code: "KHMT", name: "Khoa học Máy tính", facultyCode: "CNTT" },
      { code: "HTTT", name: "Hệ thống Thông tin", facultyCode: "CNTT" },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 1);
    assert.strictEqual(result.skipped, 1);
    assert.strictEqual(result.failed, 0);
  });

  it("should handle validation errors", async () => {
    const useCase = new ImportDepartments(
      makeFacultyRepo(() => ({ id: "faculty-1", code: "CNTT", name: "Khoa CNTT" })),
      makeDepartmentRepo({}),
    );

    const rows = [
      { code: "", name: "Khoa học Máy tính", facultyCode: "CNTT" }, // Invalid: empty code
      { code: "HTTT", name: "", facultyCode: "CNTT" }, // Invalid: empty name
      { code: "KHMT", name: "Valid Department", facultyCode: "CNTT" }, // Valid
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 3);
    assert.strictEqual(result.created, 1);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 2);
    assert.strictEqual(result.errors.length, 2);
    assert.strictEqual(result.errors[0].row, 1);
    assert.strictEqual(result.errors[1].row, 2);
  });

  it("should handle missing facultyCode", async () => {
    const useCase = new ImportDepartments(
      makeFacultyRepo(() => ({ id: "faculty-1", code: "CNTT", name: "Khoa CNTT" })),
      makeDepartmentRepo({}),
    );

    const rows = [
      { code: "KHMT", name: "Khoa học Máy tính" }, // Missing facultyCode
    ] as unknown[];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.created, 0);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 1);
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result.errors[0].code, "VALIDATION_ERROR");
  });

  it("should handle invalid facultyCode", async () => {
    const useCase = new ImportDepartments(
      makeFacultyRepo((code) =>
        code === "INVALID" ? null : { id: "faculty-1", code: "CNTT", name: "Khoa CNTT" },
      ),
      makeDepartmentRepo({}),
    );

    const rows = [
      { code: "KHMT", name: "Khoa học Máy tính", facultyCode: "INVALID" },
      { code: "HTTT", name: "Hệ thống Thông tin", facultyCode: "CNTT" },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 1);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 1);
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result.errors[0].row, 1);
    assert.strictEqual(result.errors[0].code, "FOREIGN_KEY_ERROR");
    assert.ok(result.errors[0].message.includes("INVALID"));
  });

  it("should process large batches correctly", async () => {
    const useCase = new ImportDepartments(
      makeFacultyRepo(() => ({ id: "faculty-1", code: "CNTT", name: "Khoa CNTT" })),
      makeDepartmentRepo({}),
    );

    // Create 600 rows to test batch processing (batch size is 500)
    const rows = Array.from({ length: 600 }, (_, i) => ({
      code: `CODE${i}`,
      name: `Department ${i}`,
      facultyCode: "CNTT",
    }));

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 600);
    assert.strictEqual(result.created, 600);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 0);
  });

  it("should handle database errors gracefully", async () => {
    const useCase = new ImportDepartments(
      makeFacultyRepo(() => ({ id: "faculty-1", code: "CNTT", name: "Khoa CNTT" })),
      makeDepartmentRepo({
        create: (data) => {
          if (data.code === "ERROR") {
            throw new Error("Database error");
          }
          return { id: "test-id", ...data, createdAt: new Date(), updatedAt: new Date() };
        },
      }),
    );

    const rows = [
      { code: "KHMT", name: "Valid Department", facultyCode: "CNTT" },
      { code: "ERROR", name: "Will fail", facultyCode: "CNTT" },
      { code: "HTTT", name: "Another valid", facultyCode: "CNTT" },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 3);
    assert.strictEqual(result.created, 2);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 1);
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result.errors[0].row, 2);
    assert.strictEqual(result.errors[0].code, "CREATE_ERROR");
  });
});
