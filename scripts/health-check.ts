#!/usr/bin/env tsx

/**
 * Health Check Script
 * 
 * Verifies the /health endpoint responds with 200 OK.
 * 
 * Usage:
 *   npm run test:api:health
 * 
 * Environment:
 *   HOST - Server host (default: localhost)
 *   PORT - Server port (default: 3000)
 */

import http from "http";

const HOST = process.env.HOST || "localhost";
const PORT = process.env.PORT || "3000";
const HEALTH_PATH = "/health";

const url = `http://${HOST}:${PORT}${HEALTH_PATH}`;

console.log(`[Health Check] Testing ${url}...`);

const req = http.get(url, (res) => {
    let data = "";

    res.on("data", (chunk) => {
        data += chunk;
    });

    res.on("end", () => {
        if (res.statusCode === 200) {
            try {
                const json = JSON.parse(data);
                console.log(`[Health Check] ✓ Success`);
                console.log(`[Health Check] Status: ${json.status}`);
                console.log(`[Health Check] Timestamp: ${json.timestamp}`);
                process.exit(0);
            } catch (err) {
                console.error(`[Health Check] ✗ Invalid JSON response`);
                console.error(data);
                process.exit(1);
            }
        } else {
            console.error(`[Health Check] ✗ Failed with status ${res.statusCode}`);
            console.error(data);
            process.exit(1);
        }
    });
});

req.on("error", (err) => {
    console.error(`[Health Check] ✗ Connection failed`);
    console.error(err.message);
    console.error(`\nIs the server running? Try: npm run dev`);
    process.exit(1);
});

req.setTimeout(5000, () => {
    console.error(`[Health Check] ✗ Timeout after 5s`);
    req.destroy();
    process.exit(1);
});
