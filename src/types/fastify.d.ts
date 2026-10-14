import type { PrismaClient } from "../generated/prisma/index.js";
import type { AppConfig } from "../config/index.js";
import type { UserRole } from "../shared/auth/Types.js";
import type { Permission } from "../shared/auth/Permissions.js";
import type { MaterializeTemplate } from "../modules/projects/domain/MaterializeTemplate.js";
import type { TokenRevocationCachePort } from "../shared/auth/TokenRevocationCachePort.js";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { ServiceLifecycle } from '../plugins/Lifecycle.js';
import type { ReadTokenSessionUseCase } from '../modules/auth/application/ReadTokenSessionUseCase.js';
import type { ServiceMetrics } from '../shared/observability/ServiceMetrics.js';
import type { BoundedRedisConnection } from '../shared/redis/BoundedRedisConnection.js';
import type { RequestRateLimit } from '../shared/rate-limit/RequestRateLimit.js';

declare module "fastify" {
    interface FastifyInstance {
        prisma: PrismaClient;
        config: AppConfig;
        lifecycle: ServiceLifecycle;
        serviceMetrics?: ServiceMetrics;
        sharedRedis?: BoundedRedisConnection;
        requestRateLimit?: RequestRateLimit;
        authSessionMetrics: () => ReturnType<ReadTokenSessionUseCase['snapshot']>;
        materializeTemplate: MaterializeTemplate;
        tokenRevocationCache: TokenRevocationCachePort;
        auth: {
            verify: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
            
            requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
            
            requireRoles: (roles: UserRole[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

            requirePermission: (permission: Permission) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
        };
    }
}

declare module "@fastify/jwt" {
    interface FastifyJWT {
        payload: {
            jti: string;
            sub: string;
            email: string;
            role: UserRole;
            [key: string]: unknown;
        };
        user: {
            jti: string;
            sub: string;
            email: string;
            role: UserRole;
            [key: string]: unknown;
        };
    }
}
