# Schema V2: Templates + Zotero Integration

This document describes the Schema V2 changes that add template management and Zotero integration to the platform.

## Overview

Schema V2 adds two major bounded contexts:
1. **Templates** — Versioned document templates for standardized academic documents
2. **Zotero Integration** — Bibliography management via Zotero API

## New Enums

### TemplateCategory
```prisma
enum TemplateCategory {
  thesis
  report
  proposal
  paper
  presentation
  other
}
```

Categories for organizing templates by document type.

### ZoteroLibraryType
```prisma
enum ZoteroLibraryType {
  user
  group
}
```

Zotero supports both personal and group libraries.

### ZoteroSyncStatus
```prisma
enum ZoteroSyncStatus {
  pending
  running
  success
  failed
}
```

Tracks the status of Zotero sync operations.

### ZoteroSyncType
```prisma
enum ZoteroSyncType {
  full
  incremental
}
```

Distinguishes between full library sync and incremental updates.

## New Models

### Template
```prisma
model Template {
  id          String             @id @default(cuid())
  name        String
  description String?
  category    TemplateCategory
  isOfficial  Boolean            @default(false)
  isActive    Boolean            @default(true)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  versions    TemplateVersion[]
  projects    Project[]
}
```

**Purpose:** Represents a document template (e.g., "University Thesis Template").

**Key fields:**
- `name` — Template display name
- `category` — Document type classification
- `isOfficial` — Whether this is an official university template
- `isActive` — Soft delete flag

**Relations:**
- `versions` — One template has many versions
- `projects` — Projects created from this template

### TemplateVersion
```prisma
model TemplateVersion {
  id            String    @id @default(cuid())
  templateId    String
  template      Template  @relation(fields: [templateId], references: [id], onDelete: Cascade)
  versionNumber String
  changelog     String?
  storageKey    String
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  projects      Project[]
}
```

**Purpose:** Represents a specific version of a template.

**Key fields:**
- `versionNumber` — Semantic version (e.g., "1.0.0", "2.1.0")
- `storageKey` — Path to template files in local storage
- `changelog` — What changed in this version
- `isActive` — Whether this version can be used for new projects

**Relations:**
- `template` — Belongs to a template
- `projects` — Projects created from this specific version

**Unique constraint:** `[templateId, versionNumber]` — prevents duplicate versions

### ZoteroConnection
```prisma
model ZoteroConnection {
  id              String              @id @default(cuid())
  userId          String
  user            User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider        String              @default("zotero")
  accessToken     String
  refreshToken    String?
  libraryId       String
  libraryType     ZoteroLibraryType
  connectedAt     DateTime            @default(now())
  lastSyncedAt    DateTime?
  updatedAt       DateTime            @updatedAt
  syncLogs        ZoteroSyncLog[]
}
```

**Purpose:** Stores a user's Zotero account connection.

**Key fields:**
- `accessToken` — OAuth access token (should be encrypted in production)
- `refreshToken` — OAuth refresh token (optional, depends on Zotero OAuth flow)
- `libraryId` — Zotero library ID
- `libraryType` — User library or group library
- `lastSyncedAt` — Last successful sync timestamp

**Relations:**
- `user` — One user can have one Zotero connection
- `syncLogs` — History of sync operations

**Unique constraint:** `[userId, provider]` — one Zotero connection per user

### ZoteroSyncLog
```prisma
model ZoteroSyncLog {
  id           String            @id @default(cuid())
  connectionId String
  connection   ZoteroConnection  @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  projectId    String?
  syncType     ZoteroSyncType
  status       ZoteroSyncStatus
  itemsSynced  Int               @default(0)
  errorMessage String?
  startedAt    DateTime          @default(now())
  finishedAt   DateTime?
}
```

**Purpose:** Audit log for Zotero sync operations.

**Key fields:**
- `projectId` — Optional, if sync was for a specific project
- `syncType` — Full or incremental sync
- `status` — Pending, running, success, or failed
- `itemsSynced` — Number of bibliography items synced
- `errorMessage` — Error details if sync failed

**Relations:**
- `connection` — Belongs to a Zotero connection

## Modified Models

### User
**Added relation:**
```prisma
zoteroConnections   ZoteroConnection[]
```

Users can now have Zotero connections.

### Project
**Added fields:**
```prisma
templateId        String?
template          Template?        @relation(fields: [templateId], references: [id], onDelete: SetNull)
templateVersionId String?
templateVersion   TemplateVersion? @relation(fields: [templateVersionId], references: [id], onDelete: SetNull)
```

Projects now track which template and version they were created from.

**Behavior:**
- `templateId` and `templateVersionId` are nullable — projects can be created without templates
- `onDelete: SetNull` — if a template is deleted, projects keep their data but lose the template reference
- Both fields are indexed for efficient queries

## Use Cases Enabled

### Templates
1. **Create project from template** — User selects template + version, system copies template files to new project
2. **Template versioning** — Update template without breaking existing projects
3. **Official templates** — University can mark templates as official/required
4. **Template catalog** — Browse templates by category

### Zotero
1. **Connect Zotero account** — OAuth flow to link user's Zotero library
2. **Sync bibliography** — Import references from Zotero to project
3. **Sync history** — Track when and what was synced
4. **Error handling** — Log sync failures for debugging

## Migration Strategy

### Prerequisites
- PostgreSQL database must be running
- `DATABASE_URL` must be configured in `.env`

### Apply Migration
```bash
npm run prisma:migrate
```

This will:
1. Create new tables: `Template`, `TemplateVersion`, `ZoteroConnection`, `ZoteroSyncLog`
2. Add new enums: `TemplateCategory`, `ZoteroLibraryType`, `ZoteroSyncStatus`, `ZoteroSyncType`
3. Add `templateId` and `templateVersionId` columns to `Project` table
4. Add `zoteroConnections` relation to `User` table

### Rollback Strategy
If migration fails or needs to be rolled back:
```bash
# Prisma doesn't have built-in rollback, but you can:
# 1. Drop the new tables manually
# 2. Remove the new columns from Project
# 3. Revert to the previous schema file
```

## Data Backfill

### Existing Projects
Existing projects will have `templateId = null` and `templateVersionId = null`. This is correct — they were not created from templates.

### Existing Users
Existing users will have no Zotero connections. Users must explicitly connect their Zotero accounts.

## Security Considerations

### Zotero Tokens
- `accessToken` and `refreshToken` are stored in plain text in V2
- **Production recommendation:** Encrypt tokens at rest using a secrets management service
- Consider using `@prisma/client` field-level encryption or application-level encryption

### Template Files
- `storageKey` points to local filesystem storage
- Template files should be read-only for non-admin users
- Validate template files before allowing them to be used

## Next Steps

After migration:
1. **Implement Templates module** — Domain, application, infra, delivery layers
2. **Implement Zotero module** — OAuth flow, sync logic, BibTeX export
3. **Update project creation flow** — Add template selection UI
4. **Seed initial templates** — Create official university templates

## API Impact

### New Endpoints (to be implemented)
- `GET /api/v1/templates` — List available templates
- `GET /api/v1/templates/:id/versions` — List template versions
- `POST /api/v1/projects` — Updated to accept `templateId` and `templateVersionId`
- `POST /api/v1/zotero/connect` — Initiate Zotero OAuth flow
- `POST /api/v1/zotero/sync` — Trigger bibliography sync
- `GET /api/v1/zotero/sync-logs` — View sync history

### Breaking Changes
None. All new fields are nullable and all new tables are independent.

## Testing Checklist

After migration:
- [ ] Verify new tables exist in database
- [ ] Verify existing projects still load correctly
- [ ] Verify existing users still authenticate correctly
- [ ] Create a test template and version
- [ ] Create a test project from template
- [ ] Verify template relationship is stored correctly
- [ ] Test Zotero connection creation
- [ ] Test Zotero sync log creation

## References

- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Zotero API Documentation](https://www.zotero.org/support/dev/web_api/v3/start)
- [Template Design Discussion](../AGENTS.MD) — See database evolution rules
