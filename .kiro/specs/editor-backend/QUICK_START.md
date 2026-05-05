# Editor Backend - Quick Start Guide

**For**: Developers testing or integrating with the editor backend  
**Status**: Implementation Complete ✅

---

## Prerequisites

### 1. Install Typst CLI
```bash
# macOS (Homebrew)
brew install typst

# Windows (Scoop)
scoop install typst

# Linux (from source)
# See: https://github.com/typst/typst#installation
```

Verify installation:
```bash
typst --version
# Should output: typst 0.11.0 or higher
```

### 2. Setup Environment
Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Auth
JWT_SECRET=your-secret-key-here

# Server
PORT=3000
HOST=0.0.0.0

# Storage
BLOB_STORAGE_DRIVER=local
STORAGE_DIR=./.storage

# Compile
COMPILE_WORKER_ENABLED=true
COMPILE_TIMEOUT_MS=60000
TYPST_BIN=typst

# Swagger
SWAGGER_ROUTE_PREFIX=/docs
ENABLE_SWAGGER=true
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Migrations
```bash
npx prisma migrate dev
```

---

## Running the Server

### Development Mode
```bash
npm run dev
```

Server starts at `http://localhost:3000`

### Production Build
```bash
npm run build
npm start
```

---

## Testing the Compile Flow

### 1. Login and Get Token
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "password"
}
```

Response:
```json
{
  "accessToken": "eyJhbGc...",
  "user": { ... }
}
```

### 2. Create a Project
```bash
POST /api/v1/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Test Project"
}
```

Response:
```json
{
  "id": "project-id",
  "title": "Test Project",
  ...
}
```

### 3. Create a Typst File
```bash
PUT /api/v1/projects/{projectId}/files/main.typ
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "= Hello World\n\nThis is a test document."
}
```

### 4. Enqueue Compile Job
```bash
POST /api/v1/projects/{projectId}/compile
Authorization: Bearer <token>
Content-Type: application/json

{
  "entryPath": "main.typ"
}
```

Response (202):
```json
{
  "job": {
    "id": "job-id",
    "projectId": "project-id",
    "entryPath": "main.typ",
    "status": "queued",
    "diagnostics": [],
    "latestArtifactId": null,
    "createdAt": "2026-05-05T10:00:00.000Z",
    "updatedAt": "2026-05-05T10:00:00.000Z"
  }
}
```

### 5. Poll Job Status
```bash
GET /api/v1/projects/{projectId}/compile/{jobId}
Authorization: Bearer <token>
```

Response when complete:
```json
{
  "job": {
    "id": "job-id",
    "status": "success",
    "latestArtifactId": "artifact-id",
    ...
  }
}
```

### 6. Download PDF
```bash
GET /api/v1/projects/{projectId}/compile/{jobId}/artifact
Authorization: Bearer <token>
```

Response: Binary PDF stream

---

## API Endpoints Reference

### Project Settings
- `GET /api/v1/projects/:id/settings` - Get settings (auto-creates)
- `PUT /api/v1/projects/:id/settings` - Update settings

### Compile
- `POST /api/v1/projects/:id/compile` - Enqueue compile job
- `GET /api/v1/projects/:id/compile` - List all jobs
- `GET /api/v1/projects/:id/compile/:jobId` - Get job details
- `GET /api/v1/projects/:id/compile/:jobId/artifact` - Download PDF

### Project Files (Enhanced)
- `GET /api/v1/projects/:id/files/*` - Get file (binary streaming for images)
- `POST /api/v1/projects/:id/files` - Create file (409 on conflict)
- `PUT /api/v1/projects/:id/files/*` - Update file
- `PATCH /api/v1/projects/:id/files:rename` - Rename file (409 on conflict)
- `DELETE /api/v1/projects/:id/files/*` - Delete file

---

## Swagger Documentation

Visit `http://localhost:3000/docs` to see interactive API documentation.

All endpoints are documented with:
- Request/response schemas
- Example payloads
- Error codes
- Authentication requirements

---

## Common Issues

### Issue: "typst: command not found"
**Solution**: Install Typst CLI (see Prerequisites)

### Issue: Compile job stays in "queued" status
**Cause**: `COMPILE_WORKER_ENABLED=false` or worker crashed  
**Solution**: 
1. Check `COMPILE_WORKER_ENABLED=true` in .env
2. Restart server
3. Check server logs for errors

### Issue: "STORAGE_NOT_FOUND" error
**Cause**: Storage directory doesn't exist or file was deleted  
**Solution**: 
1. Check `STORAGE_DIR` exists
2. Ensure write permissions
3. Check disk space

### Issue: Compile timeout
**Cause**: Document too complex or typst hanging  
**Solution**: 
1. Increase `COMPILE_TIMEOUT_MS`
2. Simplify document
3. Check typst CLI works standalone

---

## Development Tips

### Enable Debug Logging
```env
LOG_LEVEL=debug
```

### Check Queue Status
The compile queue logs job processing:
```
[INFO] Job abc123 enqueued, queue length: 1
[INFO] Processing job abc123...
[INFO] Job abc123 completed
```

### Test Diagnostic Parsing
Create a file with intentional errors:
```typst
= Test

#let x = 1 + "string"  // Type error
```

The diagnostics will include:
- Error message
- File and line number
- Hints from typst

### Monitor Storage
Check storage directory:
```bash
ls -lh .storage/
```

Files are organized by first 2 chars of sha256:
```
.storage/
  ab/
    abc123...bin
    abc123...bin.json
```

---

## Testing Checklist

### Basic Flow
- [ ] Server starts without errors
- [ ] Can login and get token
- [ ] Can create project
- [ ] Can create typst file
- [ ] Can enqueue compile job
- [ ] Job transitions: queued → running → success
- [ ] Can download PDF artifact
- [ ] PDF opens and displays content

### Error Scenarios
- [ ] Invalid typst syntax shows diagnostics
- [ ] Missing file returns 404
- [ ] Duplicate file returns 409
- [ ] Unauthorized access returns 403
- [ ] Compile timeout handled gracefully

### Binary Files
- [ ] Can upload image file
- [ ] GET image returns binary stream
- [ ] Correct Content-Type header
- [ ] Correct Content-Length header

### Project Settings
- [ ] GET settings auto-creates with defaults
- [ ] Can update mainPath
- [ ] Invalid mainPath rejected
- [ ] Non-existent mainPath rejected

---

## Performance Notes

### Compile Queue
- Single-worker FIFO queue
- Processes one job at a time
- Prevents resource exhaustion
- Graceful shutdown on server stop

### Storage
- Content-addressable (deduplication)
- SHA256 computed during upload
- Metadata stored separately
- Efficient for large files

### Transactions
- File create/update uses transactions
- Atomic timestamp updates
- Rollback on failure

---

## Next Steps

1. **Run Manual Tests**: Execute the testing checklist above
2. **Fix Binary Files**: Enhance snapshot adapter for image compilation
3. **Add Unit Tests**: Test state machine and parsers
4. **Frontend Integration**: Connect editor UI to compile API

---

## Support

**Documentation**:
- Full spec: `.kiro/specs/editor-backend/`
- Integration report: `.kiro/reports/backend-frontend-integration/editor-backend-integration-status.md`
- Implementation details: `docs/EDITOR_BACKEND_IMPLEMENTATION_COMPLETE.md`

**Issues**: Check server logs for detailed error messages

**Architecture**: See `.kiro/steering/architecture-rules.md` for design principles
