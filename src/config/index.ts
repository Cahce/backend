import "dotenv/config";
import { z } from "zod";
import { parseTrustedProxies } from './TrustedProxies.js';

const EnvSchema = z.object({
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default("0.0.0.0"),
    TRUST_PROXY_CIDRS: z.string().default('').transform((value, ctx) => {
        try { return parseTrustedProxies(value); }
        catch { ctx.addIssue({ code: 'custom', message: 'Expected trusted literal IP/CIDR addresses (no /0)' }); return z.NEVER; }
    }),
    SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(0).max(30000).default(3000),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(180000).default(40000),
    METRICS_ENABLED: z.enum(['true', 'false']).default('false'),
    METRICS_TOKEN: z.preprocess(value => typeof value === 'string' && !value.trim() ? undefined : value,
        z.string().trim().min(32).optional()),
    SHARED_STATE_DRIVER: z.enum(['local', 'redis']).default('local'),
    REDIS_URL: z.preprocess(value => typeof value === 'string' && !value.trim() ? undefined : value,
        z.string().url().refine(value => /^rediss?:\/\//.test(value), 'Expected redis:// or rediss:// URL').optional()),
    REDIS_KEY_SECRET: z.preprocess(value => typeof value === 'string' && !value.trim() ? undefined : value,
        z.string().trim().min(32).optional()),
    REDIS_NAMESPACE: z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/).default('tlu-local'),
    REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().min(50).max(2000).default(500),
    REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(2000),
    REDIS_MAX_PENDING: z.coerce.number().int().min(1).max(1024).default(256),
    DATABASE_URL: z.string().min(1),
    DIRECT_DATABASE_URL: z.preprocess(value => typeof value === 'string' && !value.trim() ? undefined : value,
        z.string().min(1).optional()),
    DB_POOL_MODE: z.enum(['direct', 'transaction']).default('direct'),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(60000).default(5000),
    JWT_SECRET: z.string().min(1),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("1d"),
    AUTH_PASSWORD_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
    AUTH_PASSWORD_MAX_OUTSTANDING: z.coerce.number().int().min(1).max(1024).default(128),
    AUTH_PASSWORD_QUEUE_WAIT_MS: z.coerce.number().int().min(1).max(30000).default(5000),
    AUTH_LOGIN_IP_PER_MINUTE: z.coerce.number().int().min(1).max(1000000).default(12000),
    AUTH_LOGIN_PAIR_PER_MINUTE: z.coerce.number().int().min(1).max(1000000).default(10),
    AUTH_CHANGE_PASSWORD_PER_MINUTE: z.coerce.number().int().min(1).max(1000000).default(5),
    SWAGGER_ROUTE_PREFIX: z.string().default("/docs"),
    BLOB_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    STORAGE_DIR: z.string().default("./.storage"),
    TEMPLATE_STORAGE_DIR: z.string().default("./storage/templates"),
    COMPILE_WORKER_ENABLED: z.enum(['true', 'false']).default('true'),
    COMPILE_MAX_OUTSTANDING_JOBS: z.coerce.number().int().min(1).max(1000).default(32),
    COMPILE_TIMEOUT_MS: z.coerce.number().int().min(100).max(600000).default(60000),
    COMPILE_FONT_DIRS: z.string().default('./var/fonts'),
    MAX_SNAPSHOT_BYTES: z.coerce.number().default(256 * 1024 * 1024),
    ZOTERO_API_BASE: z.string().default("https://api.zotero.org"),
    OPENALEX_MAILTO: z.string().default(""),
    TRANSLATION_SERVER_URL: z.string().default("http://localhost:1969"),
    MAX_UPLOAD_SIZE_BYTES: z.coerce.number().default(50 * 1024 * 1024),
    PROJECT_SHARING_ENABLED: z.enum(['true', 'false']).default('false'),
    PROJECT_REALTIME_ORIGINS: z.string().default('http://localhost:5173'),
    REALTIME_MAX_SOCKETS_PER_INSTANCE: z.coerce.number().int().min(1).max(2000).default(200),
    REALTIME_MAX_SOCKETS_GLOBAL: z.coerce.number().int().min(1).max(100000).default(10000),
}).superRefine((value, ctx) => {
    if (value.AUTH_PASSWORD_CONCURRENCY > value.AUTH_PASSWORD_MAX_OUTSTANDING) {
        ctx.addIssue({ code: 'custom', path: ['AUTH_PASSWORD_MAX_OUTSTANDING'], message: 'Outstanding capacity must cover active password work' });
    }
    if (value.REALTIME_MAX_SOCKETS_PER_INSTANCE > value.REALTIME_MAX_SOCKETS_GLOBAL) {
        ctx.addIssue({ code: 'custom', path: ['REALTIME_MAX_SOCKETS_PER_INSTANCE'], message: 'Instance socket cap must not exceed global cap' });
    }
    if (value.SHARED_STATE_DRIVER === 'redis') {
        for (const key of ['REDIS_URL', 'REDIS_KEY_SECRET'] as const) {
            if (!value[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required for shared Redis state` });
        }
    }
    if (value.METRICS_ENABLED === 'true' && !value.METRICS_TOKEN) {
        ctx.addIssue({ code: 'custom', path: ['METRICS_TOKEN'], message: 'A dedicated metrics token is required when metrics are enabled' });
    }
    if (value.SHUTDOWN_DRAIN_MS >= value.SHUTDOWN_TIMEOUT_MS) {
        ctx.addIssue({ code: 'custom', path: ['SHUTDOWN_TIMEOUT_MS'], message: 'Shutdown timeout must exceed drain delay' });
    }
    if (value.DB_POOL_MODE === 'transaction' && !value.DIRECT_DATABASE_URL) {
        ctx.addIssue({ code: 'custom', path: ['DIRECT_DATABASE_URL'],
            message: 'DIRECT_DATABASE_URL is required for LISTEN/migrations when DB_POOL_MODE=transaction' });
    }
});

const env = EnvSchema.parse(process.env);

export const config = {
    sharedState: { driver: env.SHARED_STATE_DRIVER, url: env.REDIS_URL, keySecret: env.REDIS_KEY_SECRET,
        namespace: env.REDIS_NAMESPACE, commandTimeoutMs: env.REDIS_COMMAND_TIMEOUT_MS,
        connectTimeoutMs: env.REDIS_CONNECT_TIMEOUT_MS, maxPending: env.REDIS_MAX_PENDING },
    observability: { metricsEnabled: env.METRICS_ENABLED === 'true', metricsToken: env.METRICS_TOKEN },
    collaboration: {
        enabled: env.PROJECT_SHARING_ENABLED === 'true',
        origins: env.PROJECT_REALTIME_ORIGINS.split(',').map(origin => new URL(origin.trim()).origin),
        maxSocketsPerInstance: env.REALTIME_MAX_SOCKETS_PER_INSTANCE,
        maxSocketsGlobal: env.REALTIME_MAX_SOCKETS_GLOBAL,
    },
    server: {
        trustProxy: env.TRUST_PROXY_CIDRS,
        host: env.HOST,
        port: env.PORT,
        shutdownDrainMs: env.SHUTDOWN_DRAIN_MS,
        shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
    },
    db: {
        url: env.DATABASE_URL,
        directUrl: env.DIRECT_DATABASE_URL ?? env.DATABASE_URL,
        poolMode: env.DB_POOL_MODE,
        poolMax: env.DB_POOL_MAX,
        connectionTimeoutMs: env.DB_CONNECTION_TIMEOUT_MS,
    },
    auth: {
        passwordWork: { concurrency: env.AUTH_PASSWORD_CONCURRENCY, maxOutstanding: env.AUTH_PASSWORD_MAX_OUTSTANDING,
            queueWaitMs: env.AUTH_PASSWORD_QUEUE_WAIT_MS },
        loginIpPerMinute: env.AUTH_LOGIN_IP_PER_MINUTE,
        loginPairPerMinute: env.AUTH_LOGIN_PAIR_PER_MINUTE,
        changePasswordPerMinute: env.AUTH_CHANGE_PASSWORD_PER_MINUTE,
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
        workerEnabled: env.COMPILE_WORKER_ENABLED === 'true',
        maxOutstandingJobs: env.COMPILE_MAX_OUTSTANDING_JOBS,
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
