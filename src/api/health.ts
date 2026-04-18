import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

export const healthRoutes = fp(async function healthRoutes(app: FastifyInstance) {
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
