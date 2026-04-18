import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "../shared/auth/Types.js";

export const jwtPlugin = fp(async function jwtPlugin(app: FastifyInstance) {
    const secret = app.config.auth.jwtSecret;

    await app.register(fastifyJwt, { secret });

    /**
     * Verify JWT token and check for revocation
     * Populates request.user with decoded token payload
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

        const revoked = await app.prisma.invalidToken.findUnique({
            where: { jti },
            select: { jti: true },
        });

        if (revoked) {
            return reply.code(401).send({
                error: {
                    code: "TOKEN_REVOKED",
                    message: "Token đã bị thu hồi",
                },
            });
        }
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