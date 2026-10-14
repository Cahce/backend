import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

export const healthRoutes = fp(async function healthRoutes(app: FastifyInstance) {
    app.get('/health/live', async (_request, reply) =>
        reply.header('Cache-Control', 'no-store').send({ status: 'ok' }));
    app.get('/health/ready', async (_request, reply) => {
        const ready = app.lifecycle?.isReady === true;
        return reply.header('Cache-Control', 'no-store').code(ready ? 200 : 503)
            .send({ status: ready ? 'ready' : 'unavailable' });
    });
    app.get("/health", {
        schema: {
            description: "Health check endpoint",
            tags: ["health"],
            response: {
                200: {
                    type: "object",
                    properties: {
                        status: { type: "string" },
                        timestamp: { type: "string" },
                    },
                },
            },
        },
    }, async (_request, reply) => {
        return reply.code(200).send({
            status: "ok",
            timestamp: new Date().toISOString(),
        });
    });
});

export default healthRoutes;
