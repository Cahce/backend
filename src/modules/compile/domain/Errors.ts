/**
 * Compile module domain errors
 */

export class CompileJobError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message || code);
    this.name = 'CompileJobError';
  }
}

export const CompileErrors = {
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  COMPILE_JOB_NOT_FOUND: 'COMPILE_JOB_NOT_FOUND',
  COMPILE_ARTIFACT_NOT_READY: 'COMPILE_ARTIFACT_NOT_READY',
  COMPILE_TIMEOUT: 'COMPILE_TIMEOUT',
  STORAGE_NOT_FOUND: 'STORAGE_NOT_FOUND',
} as const;
