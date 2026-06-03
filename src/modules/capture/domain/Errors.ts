/**
 * Capture Domain Errors
 *
 * Domain-specific error types. No framework dependencies.
 */

export class CaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureError";
  }
}

/** Translation-server is unreachable / returned a server error. (→ 502) */
export class TranslationUnavailableError extends CaptureError {
  constructor(
    message: string = "Dịch vụ trích xuất metadata tạm thời không khả dụng"
  ) {
    super(message);
    this.name = "TranslationUnavailableError";
  }
}

/** Translation-server could not recognise the page/identifier. (→ 422) */
export class TranslationNoResultError extends CaptureError {
  constructor(
    message: string = "Không nhận diện được tài liệu từ liên kết/định danh này"
  ) {
    super(message);
    this.name = "TranslationNoResultError";
  }
}

/** Invalid capture input (wrong number of sources, or no save target). (→ 400) */
export class CaptureInvalidInputError extends CaptureError {
  constructor(message: string = "Dữ liệu thu thập không hợp lệ") {
    super(message);
    this.name = "CaptureInvalidInputError";
  }
}
