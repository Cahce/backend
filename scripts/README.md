# Backend Test Scripts

Simple smoke test scripts to verify the backend is running correctly.

## Available Scripts

### Health Check
```bash
npm run test:api:health
```

Tests the `/health` endpoint and verifies it returns `200 OK` with valid JSON.

**Use case:** Quick verification that the server is alive and responding.

### Smoke Test
```bash
npm run test:api:smoke
```

Runs a suite of basic smoke tests:
- Health endpoint responds
- Swagger docs are accessible
- Swagger JSON is available
- 404 handling works correctly

**Use case:** Verify core API functionality after deployment or major changes.

## Usage

1. **Start the server** in one terminal:
   ```bash
   npm run dev
   ```

2. **Run tests** in another terminal:
   ```bash
   npm run test:api:health
   # or
   npm run test:api:smoke
   ```

## Environment Variables

Both scripts respect the same environment variables as the backend:

- `HOST` - Server host (default: `localhost`)
- `PORT` - Server port (default: `3000`)
- `SWAGGER_ROUTE_PREFIX` - Swagger route (default: `/docs`)

Example:
```bash
HOST=0.0.0.0 PORT=8080 npm run test:api:smoke
```

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed or connection error

## Notes

- These are **smoke tests**, not comprehensive integration tests
- They require the server to be running
- They use plain Node.js `http` module (no external dependencies)
- Timeout is set to 5 seconds per request
