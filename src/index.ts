import { buildApp } from "./app.js";
import { createGracefulShutdown } from './shared/server/GracefulShutdown.js';

async function start() {
    const app = await buildApp();
    const shutdown = createGracefulShutdown({
        beginDrain: () => { app.lifecycle.beginDrain(); app.log.info('Server draining'); },
        close: () => app.close(),
        reportError: error => app.log.error({ err: error }, 'Shutdown failed'),
        forceExit: () => process.exit(1),
        drainMs: app.config.server.shutdownDrainMs,
        timeoutMs: app.config.server.shutdownTimeoutMs,
    });
    const onSignal = () => { void shutdown(); };
    process.once('SIGTERM', onSignal);
    process.once('SIGINT', onSignal);
    app.addHook('onClose', async () => {
        process.off('SIGTERM', onSignal); process.off('SIGINT', onSignal);
    });

    try {
        const address = await app.listen({
            host: app.config.server.host,
            port: app.config.server.port,
        });

        app.log.info(`Server listening at ${address}`);
        app.log.info(`Swagger docs available at ${address}${app.config.swagger.routePrefix}`);
    } catch (err) {
        app.log.error(err);
        await app.close().catch(closeError => app.log.error({ err: closeError }, 'Startup cleanup failed'));
        process.exit(1);
    }
}

start();
