#!/usr/bin/env tsx

/**
 * API Smoke Test
 * 
 * Runs basic smoke tests against the backend API:
 * - Health endpoint responds
 * - Swagger docs are accessible
 * - Server returns proper error codes for invalid requests
 * 
 * Usage:
 *   npm run test:api:smoke
 * 
 * Environment:
 *   HOST - Server host (default: localhost)
 *   PORT - Server port (default: 3000)
 *   SWAGGER_ROUTE_PREFIX - Swagger route (default: /docs)
 */

import http from "http";

const HOST = process.env.HOST || "localhost";
const PORT = process.env.PORT || "3000";
const SWAGGER_PREFIX = process.env.SWAGGER_ROUTE_PREFIX || "/docs";

let passed = 0;
let failed = 0;

function test(name: string, path: string, expectedStatus: number): Promise<boolean> {
    return new Promise((resolve) => {
        const url = `http://${HOST}:${PORT}${path}`;
        
        const req = http.get(url, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                if (res.statusCode === expectedStatus) {
                    console.log(`✓ ${name}`);
                    passed++;
                    resolve(true);
                } else {
                    console.error(`✗ ${name}`);
                    console.error(`  Expected ${expectedStatus}, got ${res.statusCode}`);
                    failed++;
                    resolve(false);
                }
            });
        });

        req.on("error", (err) => {
            console.error(`✗ ${name}`);
            console.error(`  ${err.message}`);
            failed++;
            resolve(false);
        });

        req.setTimeout(5000, () => {
            console.error(`✗ ${name}`);
            console.error(`  Timeout after 5s`);
            req.destroy();
            failed++;
            resolve(false);
        });
    });
}

async function runTests() {
    console.log(`[Smoke Test] Running against http://${HOST}:${PORT}\n`);

    await test("Health endpoint responds", "/health", 200);
    await test("Swagger docs accessible", SWAGGER_PREFIX, 200);
    await test("Swagger JSON accessible", `${SWAGGER_PREFIX}/json`, 200);
    await test("404 for unknown route", "/this-route-does-not-exist", 404);

    console.log(`\n[Smoke Test] Results: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        console.error(`\n[Smoke Test] ✗ Some tests failed`);
        process.exit(1);
    } else {
        console.log(`\n[Smoke Test] ✓ All tests passed`);
        process.exit(0);
    }
}

runTests().catch((err) => {
    console.error(`[Smoke Test] ✗ Unexpected error`);
    console.error(err);
    process.exit(1);
});
