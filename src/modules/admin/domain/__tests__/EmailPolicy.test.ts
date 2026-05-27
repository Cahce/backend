import { describe, it } from "node:test";
import assert from "node:assert";
import { EnvEmailPolicy } from "../AccountManagement/Policies.js";

describe("EnvEmailPolicy", () => {
  const policy = new EnvEmailPolicy();

  describe("Admin email validation", () => {
    it("should accept valid admin email with @tlu.edu.vn", () => {
      const result = policy.validate("admin@tlu.edu.vn", "admin");
      assert.strictEqual(result.ok, true);
    });

    it("should accept admin email with different local part", () => {
      const result = policy.validate("john.doe@tlu.edu.vn", "admin");
      assert.strictEqual(result.ok, true);
    });

    it("should reject admin email with student domain", () => {
      const result = policy.validate("admin@e.tlu.edu.vn", "admin");
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, "INVALID_EMAIL_DOMAIN");
        assert.ok(result.message.includes("@tlu.edu.vn"));
      }
    });

    it("should reject admin email with invalid format", () => {
      const result = policy.validate("invalid-email", "admin");
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, "INVALID_EMAIL_FORMAT");
      }
    });
  });

  describe("Teacher email validation", () => {
    it("should accept valid teacher email with @tlu.edu.vn", () => {
      const result = policy.validate("teacher@tlu.edu.vn", "teacher");
      assert.strictEqual(result.ok, true);
    });

    it("should reject teacher email with student domain", () => {
      const result = policy.validate("teacher@e.tlu.edu.vn", "teacher");
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, "INVALID_EMAIL_DOMAIN");
      }
    });
  });

  describe("Student email validation", () => {
    it("should accept valid student email with @e.tlu.edu.vn", () => {
      const result = policy.validate("student@e.tlu.edu.vn", "student");
      assert.strictEqual(result.ok, true);
    });

    it("should accept student email with numbers", () => {
      const result = policy.validate("2021603456@e.tlu.edu.vn", "student");
      assert.strictEqual(result.ok, true);
    });

    it("should reject student email with staff domain", () => {
      const result = policy.validate("student@tlu.edu.vn", "student");
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, "INVALID_EMAIL_DOMAIN");
        assert.ok(result.message.includes("@e.tlu.edu.vn"));
      }
    });
  });

  describe("Case insensitivity", () => {
    it("should accept email with uppercase domain", () => {
      const result = policy.validate("admin@TLU.EDU.VN", "admin");
      assert.strictEqual(result.ok, true);
    });

    it("should accept email with mixed case", () => {
      const result = policy.validate("Admin@Tlu.Edu.Vn", "admin");
      assert.strictEqual(result.ok, true);
    });

    it("should accept student email with uppercase", () => {
      const result = policy.validate("STUDENT@E.TLU.EDU.VN", "student");
      assert.strictEqual(result.ok, true);
    });
  });

  describe("Edge cases", () => {
    it("should reject email with spaces", () => {
      const result = policy.validate("admin @tlu.edu.vn", "admin");
      assert.strictEqual(result.ok, false);
    });

    it("should reject email without @", () => {
      const result = policy.validate("admintlu.edu.vn", "admin");
      assert.strictEqual(result.ok, false);
    });

    it("should reject empty email", () => {
      const result = policy.validate("", "admin");
      assert.strictEqual(result.ok, false);
    });
  });

  describe("normalize", () => {
    it("should normalize email to lowercase", () => {
      const normalized = EnvEmailPolicy.normalize("Admin@TLU.EDU.VN");
      assert.strictEqual(normalized, "admin@tlu.edu.vn");
    });

    it("should trim whitespace", () => {
      const normalized = EnvEmailPolicy.normalize("  admin@tlu.edu.vn  ");
      assert.strictEqual(normalized, "admin@tlu.edu.vn");
    });
  });
});
