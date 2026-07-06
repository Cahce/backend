
export class CaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureError";
  }
}

export class TranslationUnavailableError extends CaptureError {
  constructor(
    message: string = "Dịch vụ trích xuất metadata tạm thời không khả dụng"
  ) {
    super(message);
    this.name = "TranslationUnavailableError";
  }
}

export class TranslationNoResultError extends CaptureError {
  constructor(
    message: string = "Không nhận diện được tài liệu từ liên kết/định danh này"
  ) {
    super(message);
    this.name = "TranslationNoResultError";
  }
}

export class CaptureInvalidInputError extends CaptureError {
  constructor(message: string = "Dữ liệu thu thập không hợp lệ") {
    super(message);
    this.name = "CaptureInvalidInputError";
  }
}
