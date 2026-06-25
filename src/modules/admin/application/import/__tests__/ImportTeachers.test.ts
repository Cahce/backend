import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { ImportTeachers } from "../ImportTeachers.js";
import type { DepartmentRepo } from "../../../domain/Department/Ports.js";
import type { TeacherProfileRepo } from "../../../domain/TeacherManagement/Ports.js";
import type { AdminAccountRepo } from "../../../domain/AccountManagement/Ports.js";
import type { PasswordHasher } from "../../../domain/shared/PasswordHasher.js";

/**
 * Build an ImportTeachers wired to in-memory fakes of its domain ports.
 * `teacherCreates` / `userCreates` capture the data passed to repo.create so
 * tests can assert on the auto-generated teacherCodes.
 */
function buildUseCase(opts: {
  existingTeacherCodes?: string[];
  teacherCreates?: Record<string, unknown>[];
  userCreates?: Record<string, unknown>[];
}): ImportTeachers {
  const teacherCreates = opts.teacherCreates ?? [];
  const userCreates = opts.userCreates ?? [];

  const departmentRepo = {
    findByCode: mock.fn(async (code: string) => ({ id: `dept-${code}`, code })),
  } as unknown as DepartmentRepo;

  const teacherRepo = {
    listAllTeacherCodes: mock.fn(async () => opts.existingTeacherCodes ?? []),
    findByTeacherCode: mock.fn(async () => null),
    findByAccountId: mock.fn(async () => null),
    create: mock.fn(async (data: Record<string, unknown>) => {
      teacherCreates.push(data);
      return { id: `t-${teacherCreates.length}`, ...data };
    }),
  } as unknown as TeacherProfileRepo;

  const accountRepo = {
    findByEmail: mock.fn(async () => null),
    create: mock.fn(async (data: Record<string, unknown>) => {
      userCreates.push(data);
      return { id: `u-${userCreates.length}`, ...data };
    }),
  } as unknown as AdminAccountRepo;

  const passwordHasher = {
    hash: mock.fn(async (plain: string) => `hashed:${plain}`),
  } as unknown as PasswordHasher;

  return new ImportTeachers(departmentRepo, teacherRepo, accountRepo, passwordHasher);
}

describe("ImportTeachers - Vietnamese headers + auto teacherCode", () => {
  it("accepts the Vietnamese template (no Mã GV column) and auto-generates teacher codes", async () => {
    const teacherCreates: Record<string, unknown>[] = [];
    const userCreates: Record<string, unknown>[] = [];
    const useCase = buildUseCase({
      existingTeacherCodes: ["GV001", "GV002"],
      teacherCreates,
      userCreates,
    });

    const rows = [
      {
        STT: "1",
        "Họ và Tên": "Kiều Tuấn Dũng",
        "Học hàm": "Không",
        "Học vị": "Thạc sĩ",
        "Bộ Môn": "KTPM",
        Email: "kieutuandung@tlu.edu.vn",
        "Mật Khẩu": "Abcdef123!",
        "Số điện thoại": "987654321",
      },
      {
        STT: "2",
        "Họ và Tên": "Phạm Văn C",
        "Học hàm": "Phó Giáo sư",
        "Học vị": "Tiến sĩ",
        "Bộ Môn": "HTTT",
        Email: "phamvanc@tlu.edu.vn",
        "Mật Khẩu": "Abcdef123!",
        "Số điện thoại": "911223344",
      },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 2, JSON.stringify(result.errors));
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(teacherCreates.length, 2);
    assert.strictEqual(teacherCreates[0].teacherCode, "GV003");
    assert.strictEqual(teacherCreates[1].teacherCode, "GV004");
  });

  it("starts at GV001 when there are no existing teachers", async () => {
    const teacherCreates: Record<string, unknown>[] = [];
    const useCase = buildUseCase({ existingTeacherCodes: [], teacherCreates });

    const result = await useCase.execute([
      {
        "Họ và Tên": "Phạm Văn A",
        "Học hàm": "Không",
        "Học vị": "Thạc sĩ",
        "Bộ Môn": "KTPM",
        Email: "phamvana@tlu.edu.vn",
        "Mật Khẩu": "Abcdef123!",
      },
    ]);

    assert.strictEqual(result.created, 1, JSON.stringify(result.errors));
    assert.strictEqual(teacherCreates[0].teacherCode, "GV001");
  });

  it("preserves a teacherCode supplied via Mã GV and continues from there", async () => {
    const teacherCreates: Record<string, unknown>[] = [];
    const useCase = buildUseCase({
      existingTeacherCodes: ["GV001"],
      teacherCreates,
    });

    const result = await useCase.execute([
      {
        "Mã GV": "GV099",
        "Họ và Tên": "Override Code",
        "Bộ Môn": "KTPM",
        Email: "override@tlu.edu.vn",
        "Mật Khẩu": "Abcdef123!",
      },
      {
        "Họ và Tên": "Auto Next",
        "Bộ Môn": "KTPM",
        Email: "next@tlu.edu.vn",
        "Mật Khẩu": "Abcdef123!",
      },
    ]);

    assert.strictEqual(result.created, 2, JSON.stringify(result.errors));
    assert.strictEqual(teacherCreates[0].teacherCode, "GV099");
    assert.strictEqual(teacherCreates[1].teacherCode, "GV100");
  });
});
