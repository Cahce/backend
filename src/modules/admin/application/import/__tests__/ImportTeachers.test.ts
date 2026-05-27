import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { ImportTeachers } from "../ImportTeachers.js";
import type { PrismaClient } from "../../../../../generated/prisma/index.js";

function buildPrisma(opts: {
  existingTeacherCodes?: string[];
  teacherCreates?: any[];
  userCreates?: any[];
}): PrismaClient {
  const teacherCreates = opts.teacherCreates ?? [];
  const userCreates = opts.userCreates ?? [];
  return {
    teacher: {
      findMany: mock.fn(async () =>
        (opts.existingTeacherCodes ?? []).map((c) => ({ teacherCode: c })),
      ),
      findUnique: mock.fn(async () => null),
      create: mock.fn(async (args: any) => {
        teacherCreates.push(args.data);
        return { id: `t-${teacherCreates.length}`, ...args.data };
      }),
    },
    department: {
      findUnique: mock.fn(async (args: any) => ({
        id: `dept-${args.where.code}`,
        code: args.where.code,
      })),
    },
    user: {
      findUnique: mock.fn(async () => null),
      create: mock.fn(async (args: any) => {
        userCreates.push(args.data);
        return { id: `u-${userCreates.length}`, ...args.data };
      }),
    },
  } as unknown as PrismaClient;
}

describe("ImportTeachers - Vietnamese headers + auto teacherCode", () => {
  it("accepts the Vietnamese template (no Mã GV column) and auto-generates teacher codes", async () => {
    const teacherCreates: any[] = [];
    const userCreates: any[] = [];
    const prisma = buildPrisma({
      existingTeacherCodes: ["GV001", "GV002"],
      teacherCreates,
      userCreates,
    });

    const useCase = new ImportTeachers(prisma);

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
    const teacherCreates: any[] = [];
    const prisma = buildPrisma({ existingTeacherCodes: [], teacherCreates });
    const useCase = new ImportTeachers(prisma);

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
    const teacherCreates: any[] = [];
    const prisma = buildPrisma({
      existingTeacherCodes: ["GV001"],
      teacherCreates,
    });
    const useCase = new ImportTeachers(prisma);

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
