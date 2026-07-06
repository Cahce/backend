
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure<T>(code: string, message: string): Result<T> {
  return { success: false, error: { code, message } };
}
