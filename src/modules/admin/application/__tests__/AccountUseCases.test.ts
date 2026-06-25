import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import type { Account, UserRole } from "../../domain/AccountManagement/Types.js";
import { AdminAccountRepoPrisma } from "../../infra/AdminAccountRepoPrisma.js";
import { EnvEmailPolicy } from "../../domain/AccountManagement/Policies.js";
import { CreateAccountUseCase } from "../AccountManagement/CreateAccountUseCase.js";
import { GetAccountUseCase } from "../AccountManagement/GetAccountUseCase.js";
import { UpdateAccountUseCase } from "../AccountManagement/UpdateAccountUseCase.js";
import { DeleteAccountUseCase } from "../AccountManagement/DeleteAccountUseCase.js";
import { ResetAccountPasswordUseCase } from "../AccountManagement/ResetAccountPasswordUseCase.js";
import type { PasswordHasher } from "../../domain/shared/PasswordHasher.js";

type MockUser = {
  id: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

class MockPrismaClient {
  user = {
    findUnique: async (_args: any): Promise<MockUser | null> => null,
    findMany: async (_args: any): Promise<MockUser[]> => [],
    count: async (_args: any) => 0,
    create: async (_args: any): Promise<MockUser> => ({} as MockUser),
    update: async (_args: any): Promise<MockUser> => ({} as MockUser),
    delete: async (_args: any) => ({} as MockUser),
  };

  teacher = {
    count: async (_args: any) => 0,
    update: async (_args: any) => ({}),
  };

  student = {
    count: async (_args: any) => 0,
    update: async (_args: any) => ({}),
  };
}

function makeUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-1",
    email: "admin@tlu.edu.vn",
    role: "admin",
    passwordHash: "hashed",
    isActive: true,
    mustChangePassword: false,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Account Use Cases", () => {
  let mockPrisma: MockPrismaClient;
  let accountRepo: AdminAccountRepoPrisma;
  let emailPolicy: EnvEmailPolicy;
  let passwordHasher: PasswordHasher;

  beforeEach(() => {
    mockPrisma = new MockPrismaClient();
    accountRepo = new AdminAccountRepoPrisma(mockPrisma as any);
    emailPolicy = new EnvEmailPolicy();
    passwordHasher = { hash: async (plain: string) => "hashed:" + plain };
  });

  describe("CreateAccountUseCase", () => {
    it("should create account with valid data", async () => {
      const useCase = new CreateAccountUseCase(accountRepo, emailPolicy, passwordHasher);
      mockPrisma.user.findUnique = async () => null;
      mockPrisma.user.create = async () => makeUser();

      const result = await useCase.execute({
        email: "admin@tlu.edu.vn",
        password: "password123",
        role: "admin",
      });

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.email, "admin@tlu.edu.vn");
      }
    });

    it("should reject invalid email domain for role", async () => {
      const useCase = new CreateAccountUseCase(accountRepo, emailPolicy, passwordHasher);
      mockPrisma.user.findUnique = async () => null;

      const result = await useCase.execute({
        email: "student@tlu.edu.vn",
        password: "password123",
        role: "student",
      });

      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error.code, "INVALID_EMAIL_DOMAIN");
      }
    });

    it("should reject duplicate email", async () => {
      const useCase = new CreateAccountUseCase(accountRepo, emailPolicy, passwordHasher);
      mockPrisma.user.findUnique = async () => makeUser();

      const result = await useCase.execute({
        email: "admin@tlu.edu.vn",
        password: "password123",
        role: "admin",
      });

      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error.code, "EMAIL_EXISTS");
      }
    });
  });

  describe("GetAccountUseCase", () => {
    it("should get account by id", async () => {
      const useCase = new GetAccountUseCase(accountRepo);
      mockPrisma.user.findUnique = async () => makeUser();

      const result = await useCase.execute({ id: "user-1" });

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.id, "user-1");
        assert.strictEqual(result.data.email, "admin@tlu.edu.vn");
      }
    });

    it("should return ACCOUNT_NOT_FOUND when account does not exist", async () => {
      const useCase = new GetAccountUseCase(accountRepo);
      mockPrisma.user.findUnique = async () => null;

      const result = await useCase.execute({ id: "non-existent" });

      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error.code, "ACCOUNT_NOT_FOUND");
      }
    });
  });

  describe("UpdateAccountUseCase", () => {
    it("should update account email", async () => {
      const useCase = new UpdateAccountUseCase(accountRepo, emailPolicy);
      const existing = makeUser({ email: "old@tlu.edu.vn" });
      const updated = makeUser({ email: "new@tlu.edu.vn" });

      mockPrisma.user.findUnique = async (args: any) => {
        if (args.where?.id) return existing;
        if (args.where?.email === "new@tlu.edu.vn") return null;
        return null;
      };
      mockPrisma.user.update = async () => updated;

      const result = await useCase.execute({
        id: "user-1",
        email: "new@tlu.edu.vn",
      });

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.email, "new@tlu.edu.vn");
      }
    });

    it("should reject invalid email domain when changing role", async () => {
      const useCase = new UpdateAccountUseCase(accountRepo, emailPolicy);
      mockPrisma.user.findUnique = async () => makeUser();

      const result = await useCase.execute({
        id: "user-1",
        role: "student",
      });

      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error.code, "INVALID_EMAIL_DOMAIN");
      }
    });
  });

  describe("DeleteAccountUseCase", () => {
    it("should delete account without links", async () => {
      const useCase = new DeleteAccountUseCase(accountRepo);
      mockPrisma.user.findUnique = async () => makeUser();
      mockPrisma.teacher.count = async () => 0;
      mockPrisma.student.count = async () => 0;
      mockPrisma.user.delete = async () => makeUser();

      const result = await useCase.execute({ id: "user-1" });
      assert.strictEqual(result.success, true);
    });

    it("should reject delete when account has linked teacher", async () => {
      const useCase = new DeleteAccountUseCase(accountRepo);
      mockPrisma.user.findUnique = async () => makeUser({ role: "teacher", email: "teacher@tlu.edu.vn" });
      mockPrisma.teacher.count = async () => 1;
      mockPrisma.student.count = async () => 0;

      const result = await useCase.execute({ id: "user-1" });
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.strictEqual(result.error.code, "ACCOUNT_HAS_LINK");
      }
    });
  });

  describe("ResetAccountPasswordUseCase", () => {
    it("should reset password and set passwordChangedAt", async () => {
      const useCase = new ResetAccountPasswordUseCase(accountRepo, passwordHasher);
      const updated = makeUser({ passwordHash: "new-hash", passwordChangedAt: new Date() });

      mockPrisma.user.findUnique = async () => makeUser();
      mockPrisma.user.update = async () => updated;

      const result = await useCase.execute({
        id: "user-1",
        newPassword: "newpassword123",
      });

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.ok(result.data.passwordChangedAt !== null);
      }
    });
  });

  it("Account/UserRole types are available", () => {
    const sample: Account = makeUser();
    const role: UserRole = sample.role;
    assert.ok(role);
  });
});
