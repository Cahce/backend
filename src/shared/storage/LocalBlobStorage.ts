import { createReadStream, createWriteStream } from "node:fs";
import type { WriteStream } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { BlobMetadata, BlobStorage } from "./BlobStorage.js";
import { STORAGE_NOT_FOUND } from "./Errors.js";

export class LocalBlobStorage implements BlobStorage {
    constructor(private readonly rootDir: string) {}

    private absPath(key: string): string {
        return join(this.rootDir, key.slice(0, 2), `${key}.bin`);
    }

    private metaPath(key: string): string {
        return `${this.absPath(key)}.json`;
    }

    /**
     * Stream `body` into the blob file. On any error mid-pipeline (write fails,
     * source aborts, client disconnects), we explicitly destroy the source
     * stream and unlink the partial `.bin` so the next put for the same key
     * starts from a clean slate. Without this cleanup, request-body streams
     * would keep being drained into RAM after the write target died, and
     * orphan partial files would litter the storage directory.
     */
    async put(
        key: string,
        body: Readable | Buffer,
        contentType: string,
    ): Promise<BlobMetadata> {
        const file = this.absPath(key);
        await mkdir(dirname(file), { recursive: true });
        const hash = createHash("sha256");
        let sizeBytes = 0;
        const source = Buffer.isBuffer(body) ? Readable.from([body]) : body;
        let writeStream: WriteStream | undefined;
        try {
            writeStream = createWriteStream(file);
            await pipeline(
                source,
                async function* (src) {
                    for await (const chunk of src) {
                        hash.update(chunk);
                        sizeBytes += chunk.length;
                        yield chunk;
                    }
                },
                writeStream,
            );
            const meta: BlobMetadata = {
                sizeBytes,
                sha256: hash.digest("hex"),
                contentType,
            };
            await writeFile(this.metaPath(key), JSON.stringify(meta));
            return meta;
        } catch (err) {
            // Tear down stream resources so they don't keep reading or
            // holding file descriptors. `destroyed` guard avoids a double
            // destroy when pipeline already cleaned its target.
            if (!source.destroyed && typeof source.destroy === "function") {
                source.destroy();
            }
            if (writeStream && !writeStream.destroyed) {
                writeStream.destroy();
            }
            // Best-effort partial-file cleanup. Ignore ENOENT (file never
            // created) and other unlink errors — they're not actionable here.
            await unlink(file).catch(() => undefined);
            throw err;
        }
    }

    async get(key: string): Promise<Readable> {
        try {
            return createReadStream(this.absPath(key));
        } catch (error) {
            throw STORAGE_NOT_FOUND(key);
        }
    }

    async head(key: string): Promise<BlobMetadata | null> {
        try {
            const raw = await readFile(this.metaPath(key), "utf8");
            return JSON.parse(raw) as BlobMetadata;
        } catch {
            return null;
        }
    }

    async delete(key: string): Promise<void> {
        await Promise.allSettled([
            unlink(this.absPath(key)),
            unlink(this.metaPath(key)),
        ]);
    }
}
