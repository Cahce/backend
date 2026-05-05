import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { BlobStorage } from "../shared/storage/BlobStorage.js";
import { createBlobStorage } from "../shared/storage/BlobStorageFactory.js";

declare module "fastify" {
    interface FastifyInstance {
        storage: BlobStorage;
    }
}

export default fp(async (app: FastifyInstance) => {
    const driver = app.config.storage.driver;
    const storageDir = app.config.storage.dir;

    const storage = createBlobStorage(driver, storageDir);
    app.decorate("storage", storage);

    app.log.info({ driver, storageDir }, "Storage driver initialized");
});
