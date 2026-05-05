export class StorageError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = "StorageError";
    }
}

export const STORAGE_NOT_FOUND = (key: string) =>
    new StorageError("STORAGE_NOT_FOUND", `Blob not found: ${key}`);

export const STORAGE_NOT_IMPLEMENTED = () =>
    new StorageError("STORAGE_NOT_IMPLEMENTED", "This storage driver is not implemented");
