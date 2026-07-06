import type { Readable } from "node:stream";

export interface BlobMetadata {
    sizeBytes: number;
    sha256: string;
    contentType: string;
}

export interface BlobStorage {
    put(
        key: string,
        body: Readable | Buffer,
        contentType: string,
    ): Promise<BlobMetadata>;

    get(key: string): Promise<Readable>;

    head(key: string): Promise<BlobMetadata | null>;

    delete(key: string): Promise<void>;
}
