/**
 * OpenAlex Domain Errors
 * 
 * Domain-specific error types.
 * No framework dependencies.
 */

/**
 * Base error for OpenAlex domain
 */
export class OpenAlexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAlexError";
  }
}

/**
 * OpenAlex work not found
 */
export class OpenAlexNotFoundError extends OpenAlexError {
  constructor(message: string = "Không tìm thấy work trên OpenAlex") {
    super(message);
    this.name = "OpenAlexNotFoundError";
  }
}

/**
 * OpenAlex API rate limit exceeded
 */
export class OpenAlexRateLimitError extends OpenAlexError {
  constructor(message: string = "Quá nhiều yêu cầu đến OpenAlex API") {
    super(message);
    this.name = "OpenAlexRateLimitError";
  }
}

/**
 * OpenAlex upstream error
 */
export class OpenAlexUpstreamError extends OpenAlexError {
  constructor(message: string) {
    super(message);
    this.name = "OpenAlexUpstreamError";
  }
}

/**
 * OpenAlex timeout error
 */
export class OpenAlexTimeoutError extends OpenAlexError {
  constructor(message: string = "Kết nối OpenAlex hết thời gian chờ") {
    super(message);
    this.name = "OpenAlexTimeoutError";
  }
}
