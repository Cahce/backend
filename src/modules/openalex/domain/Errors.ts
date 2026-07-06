
export class OpenAlexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAlexError";
  }
}

export class OpenAlexNotFoundError extends OpenAlexError {
  constructor(message: string = "Không tìm thấy work trên OpenAlex") {
    super(message);
    this.name = "OpenAlexNotFoundError";
  }
}

export class OpenAlexRateLimitError extends OpenAlexError {
  constructor(message: string = "Quá nhiều yêu cầu đến OpenAlex API") {
    super(message);
    this.name = "OpenAlexRateLimitError";
  }
}

export class OpenAlexUpstreamError extends OpenAlexError {
  constructor(message: string) {
    super(message);
    this.name = "OpenAlexUpstreamError";
  }
}

export class OpenAlexTimeoutError extends OpenAlexError {
  constructor(message: string = "Kết nối OpenAlex hết thời gian chờ") {
    super(message);
    this.name = "OpenAlexTimeoutError";
  }
}
