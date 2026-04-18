import type { PrismaClient } from "../generated/prisma/index.js";
import type { AppConfig } from "../config/index.js";
import type { UserRole } from "../shared/auth/Types.js";
import type { FastifyRequest, FastifyReply } from "fastify";

declare module "fastify" {
    interface FastifyInstance {
        prisma: PrismaClient;
        config: AppConfig;
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