/**
 * Storage Policy
 * 
 * Domain policy for determining storage mode based on file characteristics.
 * No framework dependencies.
 */

import { FileKind, StorageMode } from './Types.js';

/**
 * Storage Policy
 * 
 * Determines storage mode based on file size and kind.
 * 
 * Stage 1: Always returns 'inline' since object storage is not active.
 * Future: Will return 'object_storage' for large files or binary content.
 */
export class StoragePolicy {
  /**
   * Determines storage mode based on file size and kind.
   * 
   * Stage 1: Always returns StorageMode.Inline
   * 
   * @param _sizeBytes - File size in bytes (unused in Stage 1)
   * @param _kind - File kind (unused in Stage 1)
   * @returns Storage mode (inline or object_storage)
   */
  static determineStorageMode(_sizeBytes: number, _kind: FileKind): StorageMode {
    // Stage 1: Always use inline storage
    return StorageMode.Inline;

    // Future implementation (commented out for Stage 1):
    // const SIZE_THRESHOLD = 1024 * 1024; // 1MB
    // if (sizeBytes >= SIZE_THRESHOLD) {
    //   return StorageMode.ObjectStorage;
    // }
    // if (kind === FileKind.Image || kind === FileKind.Data) {
    //   return StorageMode.ObjectStorage;
    // }
    // return StorageMode.Inline;
  }
}
