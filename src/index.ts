import { buildApp } from "./app.js";

async function start() {
    const app = await buildApp();

    try {
        const address = await app.listen({
            host: app.config.server.host,
            port: app.config.server.port,
        });

        app.log.info(`Server listening at ${address}`);
        app.log.info(`Swagger docs available at ${address}${app.config.swagger.routePrefix}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

start();
