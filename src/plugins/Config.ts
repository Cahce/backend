import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { config } from "../config/index.js";

export const configPlugin = fp(async function configPlugin(app: FastifyInstance) {
    app.decorate("config", config);
});

export default configPlugin;
