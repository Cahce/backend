import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "../shared/auth/Types.js";
import { roleHasPermission, type Permission } from "../shared/auth/Permissions.js";
import { LruTokenRevocationCache } from "../shared/auth/LruTokenRevocationCache.js";
import { ReadTokenSessionUseCase } from '../modules/auth/application/ReadTokenSessionUseCase.js';
import { PrismaTokenSessionReader } from '../modules/auth/infra/PrismaTokenSessionReader.js';
import type { TokenSessionReader } from '../modules/auth/domain/TokenSession.js';

export const jwtPlugin = fp(async function jwtPlugin(app: FastifyInstance, options: { sessionReader?: TokenSessionReader }) {
    const secret = app.config.auth.jwtSecret;

    await app.register(fastifyJwt, { secret });

    const tokenRevocationCache = new LruTokenRevocationCache();
    app.decorate("tokenRevocationCache", tokenRevocationCache);
    const sessions = new ReadTokenSessionUseCase(options.sessionReader ?? new PrismaTokenSessionReader(app.prisma));
    app.decorate('authSessionMetrics', () => sessions.snapshot());
    app.addHook('preClose', async () => { sessions.close(); });

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
        if (typeof jti !== 'string' || !jti || jti.length > 256 ||
            typeof req.user.sub !== 'string' || !req.user.sub || req.user.sub.length > 256) {
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
        let state;
        try {
            state = await sessions.execute({ userId: req.user.sub, jti });
        } catch {
            return reply.header('Retry-After', '1').code(503).send({
                error: { code: 'AUTH_UNAVAILABLE', message: 'Tạm thời không thể xác thực. Vui lòng thử lại' },
            });
        }
        if (state?.revoked) {
            tokenRevocationCache.set(jti, "revoked");
            return reply.code(401).send({
                error: {
                    code: "TOKEN_REVOKED",
                    message: "Token đã bị thu hồi",
                },
            });
        }

        if (!state || !state.isActive) {
            return reply.code(401).send({
                error: { code: 'ACCOUNT_INACTIVE', message: 'Tài khoản không còn hoạt động' },
            });
        }
        // Role claims may outlive an admin change. All protected routes use the
        // current role, including routes that only call auth.verify.
        req.user.role = state.role;
        const route = `${req.method} ${req.routeOptions.url}`;
        const recoveryRoute = route === 'GET /api/v1/auth/me' || route === 'HEAD /api/v1/auth/me' ||
            route === 'POST /api/v1/auth/change-password' || route === 'POST /api/v1/auth/logout';
        if (state.mustChangePassword && !recoveryRoute) {
            return reply.code(403).send({
                error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'Bạn cần đổi mật khẩu trước khi tiếp tục' },
            });
        }
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
