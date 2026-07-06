export const ZMSG = {
  required: (field: string): string => `${field} là bắt buộc`,
  emailInvalid: "Định dạng email không hợp lệ",
  minLen: (field: string, n: number): string =>
    `${field} phải có ít nhất ${n} ký tự`,
  maxLen: (field: string, n: number): string => `${field} tối đa ${n} ký tự`,
  invalid: (field: string): string => `${field} không hợp lệ`,
  urlInvalid: "Đường dẫn (URL) không hợp lệ",
} as const;
