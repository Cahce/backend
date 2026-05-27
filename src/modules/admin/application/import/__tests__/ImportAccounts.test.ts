import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { ImportAccounts } from "../ImportAccounts.js";
import type { PrismaClient } from "../../../../../generated/prisma/index.js";

describe("ImportAccounts", () => {
  it("should import valid accounts successfully", async () => {
    const mockPrisma = {
      user: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
      teacher: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
      student: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportAccounts(mockPrisma);

    const rows = [
      {
        email: "admin@tlu.edu.vn",
        password: "Password123",
        role: "admin",
        isActive: "true",
      },
      {
        email: "teacher@tlu.edu.vn",
        password: "Password456",
        role: "teacher",
        isActive: "true",
      },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 2);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.errors.length, 0);
  });

  it("should skip existing accounts", async () => {
    const mockPrisma = {
      user: {
        findUnique: mock.fn(async (args: any) => {
          if (args.where.email === "admin@tlu.edu.vn") {
            return {
              id: "existing-id",
              email: "admin@tlu.edu.vn",
              role: "admin",
            };
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
      teacher: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
      student: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportAccounts(mockPrisma);

    const rows = [
      {
        email: "admin@tlu.edu.vn",
        password: "Password123",
        role: "admin",
        isActive: "true",
      },
      {
        email: "teacher@tlu.edu.vn",
        password: "Password456",
        role: "teacher",
        isActive: "true",
      },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 1);
    assert.strictEqual(result.skipped, 1);
    assert.strictEqual(result.failed, 0);
  });

  it("should validate email domain for role", async () => {
    const mockPrisma = {
      user: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
      teacher: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
      student: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportAccounts(mockPrisma);

    const rows = [
      {
        email: "student@tlu.edu.vn", // Wrong domain for student (should be @e.tlu.edu.vn)
        password: "Password123",
        role: "student",
        isActive: "true",
      },
      {
        email: "teacher@e.tlu.edu.vn", // Wrong domain for teacher (should be @tlu.edu.vn)
        password: "Password456",
        role: "teacher",
        isActive: "true",
      },
      {
        email: "valid@e.tlu.edu.vn", // Correct for student
        password: "Password789",
        role: "student",
        isActive: "true",
      },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 3);
    assert.strictEqual(result.created, 1);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 2);
    assert.strictEqual(result.errors.length, 2);
    assert.strictEqual(result.errors[0].code, "INVALID_EMAIL_DOMAIN");
    assert.strictEqual(result.errors[1].code, "INVALID_EMAIL_DOMAIN");
  });

  it("should generate password when not provided", async () => {
    const mockPrisma = {
      user: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
      teacher: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
      student: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportAccounts(mockPrisma);

    const rows = [
      {
        email: "admin@tlu.edu.vn",
        password: "", // Empty password
        role: "admin",
        isActive: "true",
      },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.created, 1);
    assert.strictEqual(result.failed, 0);
    assert.ok(result.generatedPasswords);
    assert.strictEqual(result.generatedPasswords.length, 1);
    assert.strictEqual(result.generatedPasswords[0].email, "admin@tlu.edu.vn");
    assert.ok(result.generatedPasswords[0].password.length >= 12);
  });

  it("should handle missing required fields", async () => {
    const mockPrisma = {
      user: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
      teacher: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
      student: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportAccounts(mockPrisma);

    const rows = [
      { email: "", password: "Password123", role: "admin" }, // Empty email
      { email: "admin@tlu.edu.vn", password: "Password123" }, // Missing role
    ] as any[];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 0);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 2);
    assert.strictEqual(result.errors.length, 2);
  });

  it("should link to teacher when linkType and linkCode provided", async () => {
    const mockPrisma = {
      user: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "new-account-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
      teacher: {
        findUnique: mock.fn(async (args: any) => {
          if (args.where.teacherCode === "GV001") {
            return {
              id: "teacher-id",
              teacherCode: "GV001",
              accountId: null,
            };
          }
          return null;
        }),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
      student: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportAccounts(mockPrisma);

    const rows = [
      {
        email: "teacher@tlu.edu.vn",
        password: "Password123",
        role: "teacher",
        isActive: "true",
        linkType: "teacher",
        linkCode: "GV001",
      },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.created, 1);
    assert.strictEqual(result.failed, 0);

    // Verify teacher.update was called
    const updateCalls = (mockPrisma.teacher.update as any).mock.calls;
    assert.strictEqual(updateCalls.length, 1);
    assert.strictEqual(updateCalls[0].arguments[0].where.id, "teacher-id");
    assert.strictEqual(
      updateCalls[0].arguments[0].data.accountId,
      "new-account-id"
    );
  });

  it("should fail when linkCode not found", async () => {
    const mockPrisma = {
      user: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
      teacher: {
        findUnique: mock.fn(async () => null), // Teacher not found
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
      student: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportAccounts(mockPrisma);

    const rows = [
      {
        email: "teacher@tlu.edu.vn",
        password: "Password123",
        role: "teacher",
        isActive: "true",
        linkType: "teacher",
        linkCode: "NOTFOUND",
      },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.created, 0);
    assert.strictEqual(result.failed, 1);
    assert.strictEqual(result.errors.length, 1);
    assert.ok(result.errors[0].message.includes("Không tìm thấy"));
  });

  it("should fail when teacher already has account", async () => {
    const mockPrisma = {
      user: {
        findUnique: mock.fn(async () => null),
        create: mock.fn(async (args: any) => ({
          id: "test-id",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
      teacher: {
        findUnique: mock.fn(async (args: any) => {
          if (args.where.teacherCode === "GV001") {
            return {
              id: "teacher-id",
              teacherCode: "GV001",
              accountId: "existing-account-id", // Already has account
            };
          }
          return null;
        }),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
      student: {
        findUnique: mock.fn(async () => null),
        update: mock.fn(async (args: any) => ({
          id: args.where.id,
          accountId: args.data.accountId,
        })),
      },
    } as unknown as PrismaClient;

    const useCase = new ImportAccounts(mockPrisma);

    const rows = [
      {
        email: "teacher@tlu.edu.vn",
        password: "Password123",
        role: "teacher",
        isActive: "true",
        linkType: "teacher",
        linkCode: "GV001",
      },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 1);
    assert.strictEqual(result.created, 0);
    assert.strictEqual(result.failed, 1);
    assert.strictEqual(result.errors.length, 1);
    assert.ok(result.errors[0].message.includes("đã được liên kết"));
  });
});
