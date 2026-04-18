import fp from "fastify-plugin";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import type { FastifyInstance } from "fastify";

export const prismaPlugin = fp(async function prismaPlugin(app: FastifyInstance) {
    app.log.info(`Connecting to database: ${app.config.db.url.replace(/:[^:@]+@/, ':****@')}`);
    
    const pool = new Pool({
        connectionString: app.config.db.url,
    });

    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    await prisma.$connect();
    app.log.info("Database connected successfully");
    app.decorate("prisma", prisma);

    app.addHook("onClose", async () => {
        await prisma.$disconnect();
        await pool.end();
    });
});
