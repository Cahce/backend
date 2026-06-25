/**
 * Shared HTTP error mapping.
 *
 * Single source of truth for mapping a domain error code → HTTP status and
 * building the standard `{ error: { code, message } }` envelope. Domain use
 * cases throw `new Error(<CODE>)` (or a typed error whose `.code` is the domain
 * code); delivery catches and calls {@link toErrorResponse} so every route
 * returns the same contract instead of leaking a 500.
 *
 * Framework-free (returns plain data); the route performs `reply.code().send()`.
 */

export interface ErrorEnvelope {
    error: { code: string; message: string };
}

const STATUS_BY_CODE: Record<string, number> = {
    VALIDATION_ERROR: 400,
    INVALID_MAIN_PATH: 400,
    INVALID_FILE_PATH: 400,
    INVALID_TEMPLATE_VERSION: 400,
    FORBIDDEN_EXTENSION: 400,
    ZIP_PATH_TRAVERSAL: 400,
    ZIP_MALFORMED: 400,
    UNSUPPORTED_ARCHIVE: 400,
    MISSING_FILE: 400,
    INVALID_MIME: 415,
    UNAUTHORIZED: 403,
    PROJECT_ACCESS_DENIED: 403,
    FORBIDDEN: 403,
    PROJECT_NOT_FOUND: 404,
    FILE_NOT_FOUND: 404,
    NOT_FOUND: 404,
    FILE_EXISTS: 409,
    CONFLICT: 409,
    ZIP_PAYLOAD_TOO_LARGE: 413,
    FILE_TOO_LARGE: 413,
    INTERNAL_ERROR: 500,
};

const MESSAGE_BY_CODE: Record<string, string> = {
    PROJECT_NOT_FOUND: "Không tìm thấy dự án",
    UNAUTHORIZED: "Không có quyền truy cập",
    PROJECT_ACCESS_DENIED: "Không có quyền truy cập dự án",
    INVALID_MAIN_PATH: "Đường dẫn tệp chính không hợp lệ",
    VALIDATION_ERROR: "Dữ liệu không hợp lệ",
    INTERNAL_ERROR: "Lỗi hệ thống",
};

/** Map a known domain error code to an HTTP status (defaults to 500). */
export function domainErrorToStatus(code: string): number {
    return STATUS_BY_CODE[code] ?? 500;
}

/** Build the standard error envelope; uses a known message when none is given. */
export function errorEnvelope(code: string, message?: string): ErrorEnvelope {
    return {
        error: {
            code,
            message: message ?? MESSAGE_BY_CODE[code] ?? "Đã xảy ra lỗi",
        },
    };
}

function isZodError(err: unknown): err is { issues: Array<{ message: string }> } {
    return (
        typeof err === "object" &&
        err !== null &&
        (err as { name?: string }).name === "ZodError" &&
        Array.isArray((err as { issues?: unknown }).issues)
    );
}

function extractCode(err: unknown): string {
    if (err && typeof err === "object" && typeof (err as { code?: unknown }).code === "string") {
        return (err as { code: string }).code;
    }
    if (err instanceof Error && err.message) {
        return err.message;
    }
    return "INTERNAL_ERROR";
}

/**
 * Map any caught error to `{ status, body }`. Recognizes Zod validation errors
 * (→ 400) and known domain codes; anything unknown maps to 500 INTERNAL_ERROR
 * (the caller should log the original error in that case).
 */
export function toErrorResponse(err: unknown): { status: number; body: ErrorEnvelope } {
    if (isZodError(err)) {
        const message = err.issues[0]?.message ?? MESSAGE_BY_CODE.VALIDATION_ERROR;
        return { status: 400, body: errorEnvelope("VALIDATION_ERROR", message) };
    }

    const code = extractCode(err);
    const status = STATUS_BY_CODE[code];
    if (status && status !== 500) {
        return { status, body: errorEnvelope(code) };
    }

    return { status: 500, body: errorEnvelope("INTERNAL_ERROR") };
}
