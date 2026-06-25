import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { ImportAccounts } from "../ImportAccounts.js";
import type { AdminAccountRepo } from "../../../domain/AccountManagement/Ports.js";
import type { TeacherProfileRepo } from "../../../domain/TeacherManagement/Ports.js";
import type { StudentProfileRepo } from "../../../domain/StudentManagement/Ports.js";
import type { PasswordHasher } from "../../../domain/shared/PasswordHasher.js";

/**
 * Fake account repo exposing the methods ImportAccounts uses. `linkToTeacher`
 * / `linkToStudent` are mock.fn so tests can inspect linking calls.
 */
function makeAccountRepo(opts: {
  findByEmail?: (email: string) => unknown;
  create?: (data: { email: string; passwordHash: string; role: string; isActive: boolean }) => unknown;
} = {}) {
  return {
    findByEmail: mock.fn(async (email: string) =>
      opts.findByEmail ? opts.findByEmail(email) : null,
    ),
    create: mock.fn(async (data: { email: string; passwordHash: string; role: string; isActive: boolean }) =>
      opts.create
        ? opts.create(data)
        : { id: "test-id", ...data, createdAt: new Date(), updatedAt: new Date() },
    ),
    linkToTeacher: mock.fn(async (_accountId: string, _teacherId: string) => {}),
    linkToStudent: mock.fn(async (_accountId: string, _studentId: string) => {}),
  };
}

function makeTeacherRepo(findByTeacherCode: (code: string) => unknown = () => null) {
  return { findByTeacherCode: mock.fn(async (code: string) => findByTeacherCode(code)) };
}

function makeStudentRepo(findByStudentCode: (code: string) => unknown = () => null) {
  return { findByStudentCode: mock.fn(async (code: string) => findByStudentCode(code)) };
}

function makeHasher() {
  return { hash: mock.fn(async (plain: string) => `hashed:${plain}`) };
}

function build(opts: {
  account?: Parameters<typeof makeAccountRepo>[0];
  findTeacher?: (code: string) => unknown;
  findStudent?: (code: string) => unknown;
} = {}) {
  const accountRepo = makeAccountRepo(opts.account);
  const teacherRepo = makeTeacherRepo(opts.findTeacher);
  const studentRepo = makeStudentRepo(opts.findStudent);
  const useCase = new ImportAccounts(
    accountRepo as unknown as AdminAccountRepo,
    teacherRepo as unknown as TeacherProfileRepo,
    studentRepo as unknown as StudentProfileRepo,
    makeHasher() as unknown as PasswordHasher,
  );
  return { useCase, accountRepo, teacherRepo, studentRepo };
}

describe("ImportAccounts", () => {
  it("should import valid accounts successfully", async () => {
    const { useCase } = build();

    const rows = [
      { email: "admin@tlu.edu.vn", password: "Password123", role: "admin", isActive: "true" },
      { email: "teacher@tlu.edu.vn", password: "Password456", role: "teacher", isActive: "true" },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 2);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.errors.length, 0);
  });

  it("should skip existing accounts", async () => {
    const { useCase } = build({
      account: {
        findByEmail: (email) =>
          email === "admin@tlu.edu.vn"
            ? { id: "existing-id", email: "admin@tlu.edu.vn", role: "admin" }
            : null,
      },
    });

    const rows = [
      { email: "admin@tlu.edu.vn", password: "Password123", role: "admin", isActive: "true" },
      { email: "teacher@tlu.edu.vn", password: "Password456", role: "teacher", isActive: "true" },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 1);
    assert.strictEqual(result.skipped, 1);
    assert.strictEqual(result.failed, 0);
  });

  it("should validate email domain for role", async () => {
    const { useCase } = build();

    const rows = [
      { email: "student@tlu.edu.vn", password: "Password123", role: "student", isActive: "true" }, // wrong domain
      { email: "teacher@e.tlu.edu.vn", password: "Password456", role: "teacher", isActive: "true" }, // wrong domain
      { email: "valid@e.tlu.edu.vn", password: "Password789", role: "student", isActive: "true" }, // correct
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
    const { useCase } = build();

    const rows = [
      { email: "admin@tlu.edu.vn", password: "", role: "admin", isActive: "true" }, // Empty password
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
    const { useCase } = build();

    const rows = [
      { email: "", password: "Password123", role: "admin" }, // Empty email
      { email: "admin@tlu.edu.vn", password: "Password123" }, // Missing role
    ] as unknown[];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 0);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 2);
    assert.strictEqual(result.errors.length, 2);
  });

  it("should link to teacher when linkType and linkCode provided", async () => {
    const { useCase, accountRepo } = build({
      account: {
        create: (data) => ({ id: "new-account-id", ...data, createdAt: new Date(), updatedAt: new Date() }),
      },
      findTeacher: (code) =>
        code === "GV001" ? { id: "teacher-id", teacherCode: "GV001", accountId: null } : null,
    });

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

    // Linking now goes through accountRepo.linkToTeacher(accountId, teacherId).
    const linkCalls = (accountRepo.linkToTeacher as unknown as { mock: { calls: { arguments: unknown[] }[] } }).mock.calls;
    assert.strictEqual(linkCalls.length, 1);
    assert.strictEqual(linkCalls[0].arguments[0], "new-account-id");
    assert.strictEqual(linkCalls[0].arguments[1], "teacher-id");
  });

  it("should fail when linkCode not found", async () => {
    const { useCase } = build({ findTeacher: () => null });

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
    const { useCase } = build({
      findTeacher: (code) =>
        code === "GV001"
          ? { id: "teacher-id", teacherCode: "GV001", accountId: "existing-account-id" }
          : null,
    });

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
