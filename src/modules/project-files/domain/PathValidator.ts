
export class InvalidPathError extends Error {
  constructor(message: string, public readonly code: string = "INVALID_PATH") {
    super(message);
    this.name = "InvalidPathError";
  }
}

const ALLOWED_CHAR_PATTERN = /^[\p{L}\p{N} _.\-/]+$/u;

export function validateProjectFilePath(rawPath: string): string {
  if (typeof rawPath !== "string") {
    throw new InvalidPathError("Đường dẫn tệp phải là chuỗi");
  }

  let path = rawPath.trim().replace(/\/+/g, "/");

  if (path === "") {
    throw new InvalidPathError("Đường dẫn tệp không được để trống");
  }

  if (path.startsWith("/")) {
    path = path.slice(1);
  }

  if (path === "") {
    throw new InvalidPathError("Đường dẫn tệp không được để trống");
  }

  const segments = path.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      throw new InvalidPathError(
        "Đường dẫn không được chứa '..' hoặc thư mục rỗng",
        "PATH_TRAVERSAL",
      );
    }
  }

  if (!ALLOWED_CHAR_PATTERN.test(path)) {
    throw new InvalidPathError(
      "Đường dẫn chứa ký tự không hợp lệ (chỉ cho phép chữ, số, dấu cách, '.', '-', '_', '/')",
      "INVALID_CHARS",
    );
  }

  if (path.length > 512) {
    throw new InvalidPathError("Đường dẫn quá dài (tối đa 512 ký tự)");
  }

  return path;
}
