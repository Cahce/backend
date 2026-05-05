import type { BlobStorage } from "./BlobStorage.js";
import { LocalBlobStorage } from "./LocalBlobStorage.js";
import { S3BlobStorage } from "./S3BlobStorage.js";

export function createBlobStorage(
    driver: "local" | "s3",
    storageDir: string,
): BlobStorage {
    if (driver === "s3") {
        return new S3BlobStorage();
    }
    return new LocalBlobStorage(storageDir);
}
