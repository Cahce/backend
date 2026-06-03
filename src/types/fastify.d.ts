import type { PrismaClient } from "../generated/prisma/index.js";
import type { AppConfig } from "../config/index.js";
import type { UserRole } from "../shared/auth/Types.js";
import type { Permission } from "../shared/auth/Permissions.js";
import type { MaterializeTemplate } from "../modules/projects/domain/MaterializeTemplate.js";
import type { TokenRevocationCachePort } from "../shared/auth/TokenRevocationCachePort.js";
import type { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
    interface FastifyInstance {
        prisma: PrismaClient;
        config: AppConfig;
        materializeTemplate: MaterializeTemplate;
        tokenRevocationCache: TokenRevocationCachePort;
        auth: {
            /**
             * Verify JWT token and check for revocation
             * Populates request.user with decoded token payload
             * Returns 401 if token is invalid or revoked
             */
            verify: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
            
            /**
             * Require admin role
             * Verifies JWT and checks that user role is 'admin'
             * Returns 401 if unauthenticated, 403 if not admin
             */
            requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
            
            /**
             * Require one of the specified roles
             * Verifies JWT and checks that user role matches one of the allowed roles
             * Returns 401 if unauthenticated, 403 if role not allowed
             * 
             * @param roles - Array of allowed roles
             * @returns Fastify preHandler function
             * 
             * @example
             * // Allow admin and teacher
             * preHandler: app.auth.requireRoles(["admin", "teacher"])
             */
            requireRoles: (roles: UserRole[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

            /**
             * Require a specific RBAC permission (capability derived from role).
             * Verifies JWT, then checks the user's role grants the permission.
             * Returns 401 if unauthenticated, 403 (FORBIDDEN) if the permission is missing.
             *
             * @param permission - Required permission, e.g. "users:manage"
             * @returns Fastify preHandler function
             *
             * @example
             * preHandler: app.auth.requirePermission("users:manage")
             */
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