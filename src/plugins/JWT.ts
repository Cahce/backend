import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "../shared/auth/Types.js";
import { roleHasPermission, type Permission } from "../shared/auth/Permissions.js";
import { LruTokenRevocationCache } from "../shared/auth/LruTokenRevocationCache.js";

export const jwtPlugin = fp(async function jwtPlugin(app: FastifyInstance) {
    const secret = app.config.auth.jwtSecret;

    await app.register(fastifyJwt, { secret });

    const tokenRevocationCache = new LruTokenRevocationCache();
    app.decorate("tokenRevocationCache", tokenRevocationCache);

    async function verify(req: FastifyRequest, reply: FastifyReply): Promise<void> {
        try {
            await req.jwtVerify();
        } catch (err) {
            const code = (err as { code?: string } | undefined)?.code;
            const isExpired =
                code === "FAST_JWT_EXPIRED" ||
                code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED" ||
                (err instanceof Error && /expired/i.test(err.message));
            return reply.code(401).send({
                error: isExpired
                    ? { code: "TOKEN_EXPIRED", message: "Phiên đăng nhập đã hết hạn" }
                    : { code: "UNAUTHENTICATED", message: "Chưa đăng nhập hoặc token không hợp lệ" },
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

    function requireRoles(allowedRoles: UserRole[]) {
        return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
            await verify(req, reply);

            if (reply.sent) {
                return;
            }

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

    async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
        return requireRoles(["admin"])(req, reply);
    }

    function requirePermission(permission: Permission) {
        return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
            await verify(req, reply);

            if (reply.sent) {
                return;
            }

            const userRole = req.user?.role;
            if (!userRole || !roleHasPermission(userRole, permission)) {
                return reply.code(403).send({
                    error: {
                        code: "FORBIDDEN",
                        message: "Không có quyền truy cập",
                    },
                });
            }
        };
    }

    app.decorate("auth", {
        verify,
        requireAdmin,
        requireRoles,
        requirePermission,
    });
});

export default jwtPlugin;
