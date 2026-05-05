import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default("0.0.0.0"),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    SWAGGER_ROUTE_PREFIX: z.string().default("/docs"),
    // Blob Storage
    BLOB_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    STORAGE_DIR: z.string().default("./.storage"),
    // Compile
    COMPILE_WORKER_ENABLED: z.coerce.boolean().default(true),
    COMPILE_TIMEOUT_MS: z.coerce.number().default(60000),
});

const env = EnvSchema.parse(process.env);

export const config = {
    server: {
        host: env.HOST,
        port: env.PORT,
    },
    db: {
        url: env.DATABASE_URL,
    },
    auth: {
        jwtSecret: env.JWT_SECRET,
    },
    swagger: {
        routePrefix: env.SWAGGER_ROUTE_PREFIX,
    },
    storage: {
        driver: env.BLOB_STORAGE_DRIVER,
        dir: env.STORAGE_DIR,
    },
    compile: {
        workerEnabled: env.COMPILE_WORKER_ENABLED,
        timeoutMs: env.COMPILE_TIMEOUT_MS,
    },
} as const;

export type AppConfig = typeof config;