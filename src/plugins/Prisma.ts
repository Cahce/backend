import fp from "fastify-plugin";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import type { FastifyInstance } from "fastify";
import { observePgPool } from '../shared/observability/ObservedPgPool.js';

export const prismaPlugin = fp(async function prismaPlugin(app: FastifyInstance) {
    app.log.info('Connecting to primary database');
    
    const pool = new Pool({
        connectionString: app.config.db.url,
        max: app.config.db.poolMax,
        connectionTimeoutMillis: app.config.db.connectionTimeoutMs,
    });

    const metrics = app.serviceMetrics;
    const restorePool = metrics ? observePgPool(pool, metrics) : undefined;
    pool.on('error', () => { metrics?.observePoolError(); app.log.error('Idle database connection failed'); });
    const adapter = new PrismaPg(pool);
    const queryLog: Array<{ emit: 'event'; level: 'query' }> = metrics ? [{ emit: 'event', level: 'query' }] : [];
    const prisma = new PrismaClient({ adapter, log: queryLog });
    // Register only aggregated duration/operation; query text and parameters are never logged.
    if (metrics) prisma.$on('query', event => { metrics.observeQuery(event.query, event.duration); });

    await prisma.$connect();
    app.log.info("Database connected successfully");
    app.decorate("prisma", prisma);

    app.addHook("onClose", async () => {
        await prisma.$disconnect();
        await pool.end();
        restorePool?.();
    });
});
