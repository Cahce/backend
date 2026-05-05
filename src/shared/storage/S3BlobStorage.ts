import type { Readable } from "node:stream";
import type { BlobMetadata, BlobStorage } from "./BlobStorage.js";
import { STORAGE_NOT_IMPLEMENTED } from "./Errors.js";

export class S3BlobStorage implements BlobStorage {
    async put(
        _key: string,
        _body: Readable | Buffer,
        _contentType: string,
    ): Promise<BlobMetadata> {
        throw STORAGE_NOT_IMPLEMENTED();
    }

    async get(_key: string): Promise<Readable> {
        throw STORAGE_NOT_IMPLEMENTED();
    }

    async head(_key: string): Promise<BlobMetadata | null> {
        throw STORAGE_NOT_IMPLEMENTED();
    }

    async delete(_key: string): Promise<void> {
        throw STORAGE_NOT_IMPLEMENTED();
    }
}
