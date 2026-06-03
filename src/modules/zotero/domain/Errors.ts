/**
 * Zotero Domain Errors
 * 
 * Domain-specific error types.
 * No framework dependencies.
 */

/**
 * Base error for Zotero domain
 */
export class ZoteroError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZoteroError";
  }
}

/**
 * User has not connected their Zotero account
 */
export class ZoteroNotConnectedError extends ZoteroError {
  constructor() {
    super("Chưa kết nối tài khoản Zotero");
    this.name = "ZoteroNotConnectedError";
  }
}

/**
 * Zotero API authentication failed
 */
export class ZoteroAuthError extends ZoteroError {
  constructor(message: string = "API key Zotero không hợp lệ") {
    super(message);
    this.name = "ZoteroAuthError";
  }
}

/**
 * Zotero library not found or not accessible
 */
export class ZoteroLibraryNotFoundError extends ZoteroError {
  constructor(message: string = "Không tìm thấy thư viện Zotero") {
    super(message);
    this.name = "ZoteroLibraryNotFoundError";
  }
}

/**
 * Zotero sync operation failed
 */
export class ZoteroSyncError extends ZoteroError {
  constructor(message: string) {
    super(message);
    this.name = "ZoteroSyncError";
  }
}

/**
 * Zotero API rate limit exceeded
 */
export class ZoteroRateLimitError extends ZoteroError {
  constructor(message: string = "Quá nhiều yêu cầu đến Zotero API") {
    super(message);
    this.name = "ZoteroRateLimitError";
  }
}

/**
 * Zotero connection timeout
 */
export class ZoteroTimeoutError extends ZoteroError {
  constructor(message: string = "Kết nối Zotero hết thời gian chờ") {
    super(message);
    this.name = "ZoteroTimeoutError";
  }
}

/**
 * Invalid Zotero credentials
 */
export class ZoteroInvalidCredentialsError extends ZoteroError {
  constructor(message: string = "Thông tin đăng nhập Zotero không hợp lệ") {
    super(message);
    this.name = "ZoteroInvalidCredentialsError";
  }
}

/**
 * Zotero already connected
 */
export class ZoteroAlreadyConnectedError extends ZoteroError {
  constructor(message: string = "Tài khoản Zotero đã được kết nối") {
    super(message);
    this.name = "ZoteroAlreadyConnectedError";
  }
}

/**
 * Connected Zotero API key does not have write permission.
 */
export class ZoteroWriteForbiddenError extends ZoteroError {
  constructor(
    message: string = "API key Zotero của bạn không có quyền ghi (write). Hãy tạo API key có quyền ghi rồi kết nối lại."
  ) {
    super(message);
    this.name = "ZoteroWriteForbiddenError";
  }
}
