import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

const ONE_HOUR_MS = 60 * 60 * 1000;

export const tokenCleanupPlugin = fp(
  async function tokenCleanupPlugin(app: FastifyInstance) {
    const intervalId = setInterval(async () => {
      try {
        const now = new Date();
        const [invalid, refresh] = await Promise.all([
          app.prisma.invalidToken.deleteMany({ where: { expiresAt: { lt: now } } }),
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
