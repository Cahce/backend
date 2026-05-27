import { describe, it } from "node:test";
import assert from "node:assert";
import {
  normalizeRow,
  slugFromEmailLocal,
  nextSequentialCode,
  SequentialCodeGenerator,
} from "../HeaderMap.js";

describe("normalizeRow", () => {
  it("maps Vietnamese keys to internal English keys", () => {
    const row = normalizeRow(
      { "Mã khoa": "CNTT", "Tên khoa": "Công nghệ Thông tin" },
      { "Mã khoa": "code", "Tên khoa": "name" },
    );
    assert.deepStrictEqual(row, { code: "CNTT", name: "Công nghệ Thông tin" });
  });

  it("preserves keys not present in the map (English back-compat)", () => {
    const row = normalizeRow(
      { code: "CNTT", name: "Khoa CNTT" },
      { "Mã khoa": "code", "Tên khoa": "name" },
    );
    assert.deepStrictEqual(row, { code: "CNTT", name: "Khoa CNTT" });
  });

  it("matches header lookup case-insensitively and trims whitespace", () => {
    const row = normalizeRow(
      { "  mã KHOA  ": "CNTT", "TÊN khoa": "X" },
      { "Mã khoa": "code", "Tên khoa": "name" },
    );
    assert.deepStrictEqual(row, { code: "CNTT", name: "X" });
  });

  it("drops empty-string values so Zod .optional() works", () => {
    const row = normalizeRow(
      { Email: "a@b", "Mật Khẩu": "" },
      { Email: "accountEmail", "Mật Khẩu": "accountPassword" },
    );
    assert.deepStrictEqual(row, { accountEmail: "a@b" });
  });

  it("trims string values", () => {
    const row = normalizeRow(
      { "Mã khoa": "  CNTT  " },
      { "Mã khoa": "code" },
    );
    assert.deepStrictEqual(row, { code: "CNTT" });
  });

  it("accepts mixed Vietnamese and English keys in the same row", () => {
    const row = normalizeRow(
      { "Mã khoa": "CNTT", name: "Khoa CNTT" },
      { "Mã khoa": "code", "Tên khoa": "name" },
    );
    assert.deepStrictEqual(row, { code: "CNTT", name: "Khoa CNTT" });
  });

  it("preserves non-string values", () => {
    const row = normalizeRow(
      { "Kích hoạt": true, "Số dòng": 42 },
      { "Kích hoạt": "isActive", "Số dòng": "count" },
    );
    assert.deepStrictEqual(row, { isActive: true, count: 42 });
  });
});

describe("slugFromEmailLocal", () => {
  it("strips non-alphanumerics and lower-cases the local-part", () => {
    assert.strictEqual(
      slugFromEmailLocal("Kieu.Tuan-Dung@tlu.edu.vn"),
      "kieutuandung",
    );
  });

  it("handles emails with no @", () => {
    assert.strictEqual(slugFromEmailLocal("abc.def"), "abcdef");
  });
});

describe("SequentialCodeGenerator / nextSequentialCode", () => {
  it("returns GV001 when there are no existing codes", () => {
    assert.strictEqual(nextSequentialCode([]), "GV001");
  });

  it("continues the dominant prefix with same digit width", () => {
    assert.strictEqual(nextSequentialCode(["GV001", "GV002"]), "GV003");
  });

  it("respects narrower digit widths", () => {
    assert.strictEqual(nextSequentialCode(["GV1", "GV2"]), "GV3");
  });

  it("picks the most frequent prefix when mixed", () => {
    const gen = new SequentialCodeGenerator(["GV001", "GV002", "T100"]);
    assert.strictEqual(gen.next(), "GV003");
  });

  it("skips reserved codes that would collide", () => {
    const gen = new SequentialCodeGenerator(["GV001", "GV002"]);
    gen.reserve("GV003");
    assert.strictEqual(gen.next(), "GV004");
  });

  it("advances counter on each next() call", () => {
    const gen = new SequentialCodeGenerator(["GV010"]);
    assert.strictEqual(gen.next(), "GV011");
    assert.strictEqual(gen.next(), "GV012");
    assert.strictEqual(gen.peek(), "GV013");
  });

  it("ignores codes that don't match the prefix+digits pattern", () => {
    assert.strictEqual(
      nextSequentialCode(["weird", "GV005", "GV006", "x-1"]),
      "GV007",
    );
  });
});
