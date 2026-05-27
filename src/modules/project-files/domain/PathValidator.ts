/**
 * Project-file path validator.
 *
 * Defends against path traversal (`..`), absolute paths (`/foo`), and weird
 * characters that could break our virtual-file-system assumptions (e.g. `?`
 * in URLs, null bytes, Windows reserved names).
 *
 * Returns the normalised path on success, throws `InvalidPathError` on failure.
 */

export class InvalidPathError extends Error {
  constructor(message: string, public readonly code: string = "INVALID_PATH") {
    super(message);
    this.name = "InvalidPathError";
  }
}

// Allowed characters: Unicode letters (any script), digits, dot, hyphen,
// underscore, space, forward slash. Frontend normally pre-sanitizes filenames
// down to ASCII, but legitimate user-typed paths can include Vietnamese / CJK
// — letting `\p{L}` through avoids spurious 400s on otherwise-safe input.
// Explicitly excludes backslash, control chars, null bytes, and shell
// metacharacters (`<>:"|?*`).
const ALLOWED_CHAR_PATTERN = /^[\p{L}\p{N} _.\-/]+$/u;

export function validateProjectFilePath(rawPath: string): string {
  if (typeof rawPath !== "string") {
    throw new InvalidPathError("Đường dẫn tệp phải là chuỗi");
  }

  // Trim leading/trailing whitespace + collapse repeated slashes.
  let path = rawPath.trim().replace(/\/+/g, "/");

  if (path === "") {
    throw new InvalidPathError("Đường dẫn tệp không được để trống");
  }

  // Strip leading slash (paths are relative to project root).
  if (path.startsWith("/")) {
    path = path.slice(1);
  }

  if (path === "") {
    throw new InvalidPathError("Đường dẫn tệp không được để trống");
  }

  // No traversal segments.
  const segments = path.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      throw new InvalidPathError(
        "Đường dẫn không được chứa '..' hoặc thư mục rỗng",
        "PATH_TRAVERSAL",
      );
    }
  }

  // Allowed character set (rejects `?`, `*`, `:`, null bytes, etc.).
  if (!ALLOWED_CHAR_PATTERN.test(path)) {
    throw new InvalidPathError(
      "Đường dẫn chứa ký tự không hợp lệ (chỉ cho phép chữ, số, dấu cách, '.', '-', '_', '/')",
      "INVALID_CHARS",
    );
  }

  // Reasonable length cap (matches typical filesystem limits).
  if (path.length > 512) {
    throw new InvalidPathError("Đường dẫn quá dài (tối đa 512 ký tự)");
  }

  return path;
}
