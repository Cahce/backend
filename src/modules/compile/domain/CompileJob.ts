/**
 * CompileJob domain entity
 * 
 * Represents a Typst compilation job with state machine transitions.
 */

import { CompileJobError, CompileErrors } from './Errors.js';
import type { CompileDiagnostic } from './CompileDiagnostic.js';

export type CompileStatus = 'queued' | 'running' | 'success' | 'failed';

export class CompileJob {
  constructor(
    readonly id: string,
    readonly projectId: string,
    readonly entryPath: string,
    private _status: CompileStatus,
    private _diagnostics: ReadonlyArray<CompileDiagnostic>,
    private _latestArtifactId: string | null,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  get status(): CompileStatus {
    return this._status;
  }

  get diagnostics(): ReadonlyArray<CompileDiagnostic> {
    return this._diagnostics;
  }

  get latestArtifactId(): string | null {
    return this._latestArtifactId;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Transition from queued to running
   */
  start(): void {
    if (this._status !== 'queued') {
      throw new CompileJobError(
        CompileErrors.INVALID_TRANSITION,
        `Cannot start job in status: ${this._status}`,
      );
    }
    this._status = 'running';
    this._updatedAt = new Date();
  }

  /**
   * Transition from running to success
   */
  succeed(artifactId: string): void {
    if (this._status !== 'running') {
      throw new CompileJobError(
        CompileErrors.INVALID_TRANSITION,
        `Cannot succeed job in status: ${this._status}`,
      );
    }
    this._status = 'success';
    this._latestArtifactId = artifactId;
    this._updatedAt = new Date();
  }

  /**
   * Transition from running or queued to failed
   */
  fail(diagnostics: ReadonlyArray<CompileDiagnostic>): void {
    if (this._status !== 'running' && this._status !== 'queued') {
      throw new CompileJobError(
        CompileErrors.INVALID_TRANSITION,
        `Cannot fail job in status: ${this._status}`,
      );
    }
    this._status = 'failed';
    this._diagnostics = diagnostics;
    this._updatedAt = new Date();
  }
}
