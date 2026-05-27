import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { ImportDepartments } from "../ImportDepartments.js";
import type { PrismaClient } from "../../../../../generated/prisma/index.js";

describe("ImportDepartments", () => {
  it("should import valid departments successfully", async () => {
    const mockPrisma = {
      faculty: {
        findUnique: mock.fn(async (args: any) => {
          if (args.where.code === "CNTT") {
            return { id: "faculty-1", code: "CNTT", name: "Khoa CNTT" };
          }
          return null;
        }),
      },
      department: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportDepartments(mockPrisma);

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
    const mockPrisma = {
      faculty: {
        findUnique: mock.fn(async (args: any) => ({
          id: "faculty-1",
          code: args.where.code,
          name: "Khoa",
        })),
      },
      department: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportDepartments(mockPrisma);

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
    const mockPrisma = {
      faculty: {
        findUnique: mock.fn(async () => ({
          id: "faculty-1",
          code: "CNTT",
          name: "Khoa CNTT",
        })),
      },
      department: {
        findUnique: mock.fn(async (args: any) => {
          if (args.where.code === "KHMT") {
            return { id: "existing-id", code: "KHMT", name: "Existing" };
          }
          return null;
        }),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportDepartments(mockPrisma);

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
    const mockPrisma = {
      faculty: {
        findUnique: mock.fn(async () => ({
          id: "faculty-1",
          code: "CNTT",
          name: "Khoa CNTT",
        })),
      },
      department: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportDepartments(mockPrisma);

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
    const mockPrisma = {
      faculty: {
        findUnique: mock.fn(async () => ({
          id: "faculty-1",
          code: "CNTT",
          name: "Khoa CNTT",
        })),
      },
      department: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportDepartments(mockPrisma);

    const rows = [
      { code: "KHMT", name: "Khoa học Máy tính" }, // Missing facultyCode
    ] as any[];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.created, 0);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 1);
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result.errors[0].code, "VALIDATION_ERROR");
  });

  it("should handle invalid facultyCode", async () => {
    const mockPrisma = {
      faculty: {
        findUnique: mock.fn(async (args: any) => {
          if (args.where.code === "INVALID") {
            return null; // Faculty not found
          }
          return { id: "faculty-1", code: "CNTT", name: "Khoa CNTT" };
        }),
      },
      department: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportDepartments(mockPrisma);

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
    const mockPrisma = {
      faculty: {
        findUnique: mock.fn(async () => ({
          id: "faculty-1",
          code: "CNTT",
          name: "Khoa CNTT",
        })),
      },
      department: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportDepartments(mockPrisma);

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
    const mockPrisma = {
      faculty: {
        findUnique: mock.fn(async () => ({
          id: "faculty-1",
          code: "CNTT",
          name: "Khoa CNTT",
        })),
      },
      department: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => {
          if (args.data.code === "ERROR") {
            throw new Error("Database error");
          }
          return {
            id: "test-id",
            ...args.data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportDepartments(mockPrisma);

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
