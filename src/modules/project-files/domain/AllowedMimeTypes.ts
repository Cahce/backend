
export const ALLOWED_BINARY_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "image/x-icon",
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
  "application/font-sfnt",
  "application/x-font-ttf",
  "application/x-font-otf",
  "application/vnd.ms-fontobject",
  "application/pdf",
  "application/octet-stream",
]);

export const FORBIDDEN_EXTENSIONS: ReadonlySet<string> = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".sh",
  ".bash",
  ".zsh",
  ".bat",
  ".cmd",
  ".ps1",
  ".app",
  ".msi",
  ".deb",
  ".rpm",
  ".scr",
  ".com",
  ".pif",
]);

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_BINARY_MIME_TYPES.has(mimeType.toLowerCase());
}

export function hasForbiddenExtension(path: string): boolean {
  const lower = path.toLowerCase();
  const dotIdx = lower.lastIndexOf(".");
  if (dotIdx === -1) return false;
  const ext = lower.slice(dotIdx);
  return FORBIDDEN_EXTENSIONS.has(ext);
}
