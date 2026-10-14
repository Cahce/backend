export class CollaborationError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = 'CollaborationError';
  }
}

export function requireCondition(condition: unknown, code: string, message: string, status = 403): asserts condition {
  if (!condition) throw new CollaborationError(code, message, status);
}
