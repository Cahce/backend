/**
 * Shared Vietnamese Zod validation messages.
 *
 * Single source of wording for request-DTO validation so the same Vietnamese
 * text is reused across modules instead of being duplicated (or, worse, left as
 * Zod's English defaults like "Invalid email"). Used by delivery/http DTO files
 * (Zod lives in the delivery layer; this module is framework-free generic text).
 *
 * Wording matches messages already in use (auth, faculty, templates).
 */
export const ZMSG = {
  /** Required field, e.g. "Email là bắt buộc". */
  required: (field: string): string => `${field} là bắt buộc`,
  /** Invalid email format. */
  emailInvalid: "Định dạng email không hợp lệ",
  /** Minimum length, e.g. "Mật khẩu phải có ít nhất 8 ký tự". */
  minLen: (field: string, n: number): string =>
    `${field} phải có ít nhất ${n} ký tự`,
  /** Maximum length, e.g. "Tên mẫu tối đa 200 ký tự". */
  maxLen: (field: string, n: number): string => `${field} tối đa ${n} ký tự`,
  /** Invalid enum / choice, e.g. "Vai trò không hợp lệ". */
  invalid: (field: string): string => `${field} không hợp lệ`,
  /** Invalid URL format. */
  urlInvalid: "Đường dẫn (URL) không hợp lệ",
} as const;
