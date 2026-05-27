import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { ImportFaculties } from "../ImportFaculties.js";
import type { FacultyRepo } from "../../../domain/Faculty/Ports.js";
import type {
  Faculty,
  CreateFacultyData,
  UpdateFacultyData,
  FacultyFilters,
} from "../../../domain/Faculty/Types.js";
import type { PaginatedResult } from "../../../domain/shared/Pagination.js";

type FakeFacultyRepoOptions = {
  findByCode?: FacultyRepo["findByCode"];
  create?: FacultyRepo["create"];
};

function makeFakeFacultyRepo(opts: FakeFacultyRepoOptions = {}): FacultyRepo {
  const noopAsync = mock.fn(async () => null);
  return {
    create:
      opts.create ??
      (mock.fn(async (data: CreateFacultyData): Promise<Faculty> => ({
        id: "test-id",
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as unknown as FacultyRepo["create"]),
    findById: noopAsync as unknown as FacultyRepo["findById"],
    findByCode:
      opts.findByCode ??
      (noopAsync as unknown as FacultyRepo["findByCode"]),
    findAll: (async (_filters: FacultyFilters): Promise<PaginatedResult<Faculty>> => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    })) as unknown as FacultyRepo["findAll"],
    update: (async (_id: string, _data: UpdateFacultyData): Promise<Faculty> => ({
      id: "test-id",
      code: "X",
      name: "X",
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as unknown as FacultyRepo["update"],
    delete: (async () => undefined) as unknown as FacultyRepo["delete"],
    hasChildDepartments: (async () => false) as unknown as FacultyRepo["hasChildDepartments"],
    hasChildMajors: (async () => false) as unknown as FacultyRepo["hasChildMajors"],
  };
}

describe("ImportFaculties", () => {
  it("should import valid faculties successfully", async () => {
    const repo = makeFakeFacultyRepo();
    const useCase = new ImportFaculties(repo);

    const rows = [
      { code: "CNTT", name: "Khoa Công nghệ Thông tin" },
      { code: "KTQT", name: "Khoa Kinh tế Quốc tế" },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 2);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.errors.length, 0);
  });

  it("should skip existing faculties", async () => {
    const repo = makeFakeFacultyRepo({
      findByCode: mock.fn(async (code: string): Promise<Faculty | null> => {
        if (code === "CNTT") {
          return {
            id: "existing-id",
            code: "CNTT",
            name: "Existing",
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return null;
      }) as unknown as FacultyRepo["findByCode"],
    });
    const useCase = new ImportFaculties(repo);

    const rows = [
      { code: "CNTT", name: "Khoa Công nghệ Thông tin" },
      { code: "KTQT", name: "Khoa Kinh tế Quốc tế" },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 1);
    assert.strictEqual(result.skipped, 1);
    assert.strictEqual(result.failed, 0);
  });

  it("should handle validation errors", async () => {
    const repo = makeFakeFacultyRepo();
    const useCase = new ImportFaculties(repo);

    const rows = [
      { code: "", name: "Khoa Công nghệ Thông tin" },
      { code: "KTQT", name: "" },
      { code: "CNTT", name: "Valid Faculty" },
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

  it("should handle missing required fields", async () => {
    const repo = makeFakeFacultyRepo();
    const useCase = new ImportFaculties(repo);

    const rows = [
      { code: "CNTT" },
      { name: "Khoa Kinh tế" },
    ] as unknown[];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 0);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 2);
    assert.strictEqual(result.errors.length, 2);
  });

  it("should process large batches correctly", async () => {
    const repo = makeFakeFacultyRepo();
    const useCase = new ImportFaculties(repo);

    const rows = Array.from({ length: 600 }, (_, i) => ({
      code: `CODE${i}`,
      name: `Faculty ${i}`,
    }));

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 600);
    assert.strictEqual(result.created, 600);
    assert.strictEqual(result.skipped, 0);
    assert.strictEqual(result.failed, 0);
  });

  it("accepts Vietnamese headers from the downloadable template", async () => {
    const repo = makeFakeFacultyRepo();
    const useCase = new ImportFaculties(repo);

    const rows = [
      { STT: "1", "Mã khoa": "CNTT", "Tên khoa": "Công nghệ Thông tin" },
      { STT: "2", "Mã khoa": "KT", "Tên khoa": "Kinh tế" },
    ];

    const result = await useCase.execute(rows);

    assert.strictEqual(result.total, 2);
    assert.strictEqual(result.created, 2);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.errors.length, 0);
  });

  it("should handle database errors gracefully", async () => {
    const repo = makeFakeFacultyRepo({
      create: mock.fn(async (data: CreateFacultyData): Promise<Faculty> => {
        if (data.code === "ERROR") {
          throw new Error("Database error");
        }
        return {
          id: "test-id",
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }) as unknown as FacultyRepo["create"],
    });
    const useCase = new ImportFaculties(repo);

    const rows = [
      { code: "CNTT", name: "Valid Faculty" },
      { code: "ERROR", name: "Will fail" },
      { code: "KTQT", name: "Another valid" },
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
