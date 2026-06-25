import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Periodic cleanup của bảng `InvalidToken`: xoá những row đã hết hạn
 * (`expiresAt < now`). Không cleanup thì bảng grow vô hạn dù mọi entry đã
 * vô tác dụng — schema đã có `@@index([expiresAt])` để query này hiệu quả.
 *
 * Resource discipline:
 * - `setInterval(...).unref()` để timer KHÔNG block event loop khi shutdown.
 * - `app.addHook('onClose', clearInterval)` để Fastify `app.close()` dọn sạch
 *   handle khi process tắt êm.
 *
 * Khi (B-7) graceful shutdown được ship, `app.close()` được gọi tự động trên
 * SIGTERM/SIGINT — không cần thêm signal handler ở đây.
 */
export const tokenCleanupPlugin = fp(
  async function tokenCleanupPlugin(app: FastifyInstance) {
    const intervalId = setInterval(async () => {
      try {
        const now = new Date();
        const [invalid, refresh] = await Promise.all([
          app.prisma.invalidToken.deleteMany({ where: { expiresAt: { lt: now } } }),
          // Expired rotating refresh tokens are dead weight too (revoked/rotated
          // rows past their TTL); sweep them on the same interval.
          app.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
        ]);
        if (invalid.count > 0 || refresh.count > 0) {
          app.log.info(
            { invalidTokens: invalid.count, refreshTokens: refresh.count },
            "Cleaned up expired token rows",
          );
        }
      } catch (err) {
        app.log.error({ err }, "Token cleanup failed");
      }
    }, ONE_HOUR_MS);

    // Critical: unref so timer doesn't keep the event loop alive at shutdown.
    intervalId.unref?.();

    app.addHook("onClose", async () => {
      clearInterval(intervalId);
    });

    app.log.info(
      { intervalMs: ONE_HOUR_MS },
      "InvalidToken cleanup interval registered",
    );
  },
  {
    name: "token-cleanup",
    dependencies: ["@fastify/jwt"],
  },
);

export default tokenCleanupPlugin;
