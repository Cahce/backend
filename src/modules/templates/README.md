# Templates Module

## Overview

The Templates module manages project templates and their versions. It provides:

- Template CRUD operations (admin only)
- Template version management with file storage
- Public template listing for authenticated users
- Template materialization for project creation

## Architecture

This module follows Clean Architecture principles:

```
templates/
├── domain/          # Entities, types, ports, domain errors
├── application/     # Use cases and orchestration
├── infra/           # Repository and storage implementations
├── delivery/http/   # HTTP routes and DTOs
└── Container.ts     # Dependency injection wiring
```

## Routes

### Admin Routes (require admin role)

- `POST /api/v1/admin/templates` - Create template
- `GET /api/v1/admin/templates` - List templates (with filters)
- `GET /api/v1/admin/templates/:id` - Get template by ID
- `PATCH /api/v1/admin/templates/:id` - Update template
- `DELETE /api/v1/admin/templates/:id` - Delete template
- `POST /api/v1/admin/templates/:id/versions` - Upload template version
- `GET /api/v1/admin/templates/:id/versions` - List versions
- `PATCH /api/v1/admin/templates/:id/versions/:versionId/deactivate` - Deactivate version

### Public Routes (require authentication)

- `GET /api/v1/templates` - List active templates with latest version
- `GET /api/v1/templates/:id` - Get active template by ID

## Storage

Templates are stored on the local filesystem:

- **Storage root**: Configured via `TEMPLATE_STORAGE_DIR` environment variable (default: `./storage/templates`)
- **Storage key format**: `{templateId}/{versionId}`
- **Supported formats**:
  - Single `.typ` files (max 5 MB)
  - ZIP archives (max 10 MB total, 5 MB per file)

### ZIP Archive Requirements

- Must contain `main.typ` at root level
- No path traversal (no `..` or absolute paths)
- Only text files are extracted (`.typ`, `.bib`, `.csv`, `.txt`, `.md`)

## Environment Variables

```env
TEMPLATE_STORAGE_DIR=./storage/templates
```

## Cross-Module Integration

The `MaterializeTemplateVersionUseCase` is exported for use by the `projects` module to seed project files when creating a project from a template.

## Seed Data

Three official templates are seeded by default:

1. **Mẫu Luận Văn Khóa 2024** (thesis)
2. **Mẫu Báo Cáo Thực Tập** (report)
3. **Mẫu Đề Cương Nghiên Cứu** (proposal)

Run seed: `npm run seed:templates`

## Testing

- **Unit tests**: `npm run test:unit:templates`
- **API tests**: `npm run test:api:templates`

## Specification

See `.kiro/specs/templates-backend/` for detailed requirements and design.
