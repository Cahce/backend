
import { FileKind, StorageMode } from './Types.js';

export class StoragePolicy {
  static determineStorageMode(_sizeBytes: number, _kind: FileKind): StorageMode {
    return StorageMode.Inline;

  }
}
