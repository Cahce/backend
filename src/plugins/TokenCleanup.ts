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
        const result = await app.prisma.invalidToken.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        });
        if (result.count > 0) {
          app.log.info(
            { deletedCount: result.count },
            "Cleaned up expired InvalidToken rows",
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
