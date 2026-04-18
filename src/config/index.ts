import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default("0.0.0.0"),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    SWAGGER_ROUTE_PREFIX: z.string().default("/docs"),
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
} as const;

export type AppConfig = typeof config;