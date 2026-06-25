import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default("0.0.0.0"),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    // Access token lifetime (short) + refresh token lifetime ("force re-login"
    // window). @fastify/jwt expiresIn syntax: "15m", "1h", "1d", "900s".
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("1d"),
    SWAGGER_ROUTE_PREFIX: z.string().default("/docs"),
    // Blob Storage
    BLOB_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    STORAGE_DIR: z.string().default("./.storage"),
    // Template Storage
    TEMPLATE_STORAGE_DIR: z.string().default("./storage/templates"),
    // Compile
    COMPILE_WORKER_ENABLED: z.coerce.boolean().default(true),
    COMPILE_TIMEOUT_MS: z.coerce.number().default(60000),
    COMPILE_FONT_DIRS: z.string().default('./var/fonts'),
    // Hard byte ceiling for a project-file compile snapshot (cumulative).
    MAX_SNAPSHOT_BYTES: z.coerce.number().default(256 * 1024 * 1024), // 256 MB
    // Bibliography Integration
    ZOTERO_API_BASE: z.string().default("https://api.zotero.org"),
    OPENALEX_MAILTO: z.string().default(""),
    // Zotero translation-server (self-hosted metadata extractor) base URL.
    TRANSLATION_SERVER_URL: z.string().default("http://localhost:1969"),
    // Binary File Upload
    MAX_UPLOAD_SIZE_BYTES: z.coerce.number().default(10 * 1024 * 1024), // 10 MB
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
        accessTtl: env.JWT_ACCESS_TTL,
        refreshTtl: env.JWT_REFRESH_TTL,
    },
    swagger: {
        routePrefix: env.SWAGGER_ROUTE_PREFIX,
    },
    storage: {
        driver: env.BLOB_STORAGE_DRIVER,
        dir: env.STORAGE_DIR,
    },
    templateStorage: {
        dir: env.TEMPLATE_STORAGE_DIR,
    },
    compile: {
        workerEnabled: env.COMPILE_WORKER_ENABLED,
        timeoutMs: env.COMPILE_TIMEOUT_MS,
        fontDirs: env.COMPILE_FONT_DIRS,
        maxSnapshotBytes: env.MAX_SNAPSHOT_BYTES,
    },
    bibliography: {
        zoteroApiBase: env.ZOTERO_API_BASE,
        openalexMailto: env.OPENALEX_MAILTO,
        translationServerUrl: env.TRANSLATION_SERVER_URL,
    },
    upload: {
        maxBytes: env.MAX_UPLOAD_SIZE_BYTES,
    },
} as const;

export type AppConfig = typeof config;