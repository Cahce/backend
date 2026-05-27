/**
 * Allow-list and deny-list for binary file uploads.
 *
 * Server-side validation MUST trust this list — clients can spoof MIME headers,
 * so we treat the declared MIME purely as a hint and additionally check the
 * extension against FORBIDDEN_EXTENSIONS (defense in depth).
 *
 * To add a new file type, add both:
 *   - its canonical MIME string to ALLOWED_BINARY_MIME_TYPES
 *   - any extension to the kind detector in FileKindPolicy.ts
 */

export const ALLOWED_BINARY_MIME_TYPES: ReadonlySet<string> = new Set([
  // Images
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  "image/x-icon",
  // Fonts
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
  "application/font-sfnt",
  "application/x-font-ttf",
  "application/x-font-otf",
  "application/vnd.ms-fontobject",
  // Documents
  "application/pdf",
  // Generic fallback — accepted but renderer/compiler may not use it. Allowed
  // because some browsers report it for unknown binary types.
  "application/octet-stream",
]);

/**
 * Hard reject extensions regardless of declared MIME. Executable / script files
 * have no business living in a Typst project's file tree.
 */
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
