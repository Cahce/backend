import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "../shared/auth/Types.js";
import { LruTokenRevocationCache } from "../shared/auth/LruTokenRevocationCache.js";

export const jwtPlugin = fp(async function jwtPlugin(app: FastifyInstance) {
    const secret = app.config.auth.jwtSecret;

    await app.register(fastifyJwt, { secret });

    // In-memory LRU cache cho kết quả revocation lookup.
    // Cache hit short-circuit DB query trong app.auth.verify — đây là hot path
    // (mọi route auth-required đi qua).
    //
    // - TTL 60s: logout của user khác (cùng jti) phản ứng trong ≤ 60s.
    // - LogoutUseCase invalidate cache ngay sau khi revoke → race nhỏ chấp nhận được.
    const tokenRevocationCache = new LruTokenRevocationCache();
    app.decorate("tokenRevocationCache", tokenRevocationCache);

    /**
     * Verify JWT token and check for revocation.
     * Populates request.user with decoded token payload.
     *
     * Cache hit-path: nếu `jti` đã được verify trong 60s gần đây và chưa bị
     * revoke, không query DB.
     */
    async function verify(req: FastifyRequest, reply: FastifyReply): Promise<void> {
        try {
            await req.jwtVerify();
        } catch {
            return reply.code(401).send({
                error: {
                    code: "UNAUTHENTICATED",
                    message: "Chưa đăng nhập hoặc token không hợp lệ",
                },
            });
        }

        const jti = req.user?.jti;
        if (!jti) {
            return reply.code(401).send({
                error: {
                    code: "TOKEN_MISSING_JTI",
                    message: "Token không hợp lệ",
                },
            });
        }

        // Cache hit path — không đụng DB.
        const cached = tokenRevocationCache.get(jti);
        if (cached === "revoked") {
            return reply.code(401).send({
                error: {
                    code: "TOKEN_REVOKED",
                    message: "Token đã bị thu hồi",
                },
            });
        }
        if (cached === "valid") {
            return;
        }

        // Cache miss — fall back DB lookup.
        const revoked = await app.prisma.invalidToken.findUnique({
            where: { jti },
            select: { jti: true },
        });

        if (revoked) {
            tokenRevocationCache.set(jti, "revoked");
            return reply.code(401).send({
                error: {
                    code: "TOKEN_REVOKED",
                    message: "Token đã bị thu hồi",
                },
            });
        }

        tokenRevocationCache.set(jti, "valid");
    }

    /**
     * Require one of the specified roles
     * First verifies JWT, then checks if user role matches one of the allowed roles
     */
    function requireRoles(allowedRoles: UserRole[]) {
        return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
            // First verify authentication
            await verify(req, reply);

            // If verify sent a response, stop here
            if (reply.sent) {
                return;
            }

            // Check role authorization
            const userRole = req.user?.role;
            if (!userRole || !allowedRoles.includes(userRole)) {
                return reply.code(403).send({
                    error: {
                        code: "FORBIDDEN",
                        message: "Không có quyền truy cập",
                    },
                });
            }
        };
    }

    /**
     * Require admin role
     * Convenience wrapper around requireRoles(["admin"])
     */
    async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
        return requireRoles(["admin"])(req, reply);
    }

    app.decorate("auth", {
        verify,
        requireAdmin,
        requireRoles,
    });
});

export default jwtPlugin;
