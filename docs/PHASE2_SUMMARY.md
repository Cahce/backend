# Phase 2 Summary: Schema V2 Design Complete

## What Was Done

Schema V2 has been designed and implemented in `prisma/schema.prisma`. The Prisma client has been regenerated with the new models.

## New Bounded Contexts

### 1. Templates Domain
**Purpose:** Manage versioned document templates for standardized academic documents.

**Models:**
- `Template` — Template metadata (name, category, official status)
- `TemplateVersion` — Specific versions with changelog and storage location

**Key Features:**
- Template versioning (projects remember which version they used)
- Category-based organization (thesis, report, proposal, paper, presentation)
- Official template marking (for university-required templates)
- Soft delete support (`isActive` flag)

**Project Integration:**
- Projects now have optional `templateId` and `templateVersionId` fields
- Projects created without templates have these fields as `null`
- Template deletion doesn't break projects (`onDelete: SetNull`)

### 2. Zotero Integration Domain
**Purpose:** Connect user Zotero accounts and sync bibliography data.

**Models:**
- `ZoteroConnection` — User's Zotero account connection (OAuth tokens, library info)
- `ZoteroSyncLog` — Audit log of sync operations

**Key Features:**
- Per-user Zotero connections
- Support for both user and group libraries
- Sync history tracking (full vs incremental)
- Error logging for failed syncs

**Design Philosophy:**
- Option A+ approach (not full citation manager)
- Zotero connection stored separately (not in Json)
- Output is still `.bib` files (Typst handles citations)
- Sync logs provide observability

## Schema Changes Summary

### New Enums (4)
1. `TemplateCategory` — thesis, report, proposal, paper, presentation, other
2. `ZoteroLibraryType` — user, group
3. `ZoteroSyncStatus` — pending, running, success, failed
4. `ZoteroSyncType` — full, incremental

### New Models (4)
1. `Template` — 9 fields, relations to versions and projects
2. `TemplateVersion` — 8 fields, unique constraint on [templateId, versionNumber]
3. `ZoteroConnection` — 11 fields, unique constraint on [userId, provider]
4. `ZoteroSyncLog` — 9 fields, tracks sync operations

### Modified Models (2)
1. `User` — Added `zoteroConnections` relation
2. `Project` — Added `templateId`, `template`, `templateVersionId`, `templateVersion`

## What Was NOT Added (By Design)

Following our scope decisions, we did NOT add:
- ❌ ProjectStatus enum (no review workflow yet)
- ❌ ProjectComment model (no comment system yet)
- ❌ ProjectActivity model (no activity log yet)
- ❌ Template inheritance (too complex for V2)
- ❌ Multi-provider citations (Zotero only)
- ❌ Full reference caching (lightweight sync only)

These can be added later if needed.

## Migration Status

**Prisma Client:** ✅ Regenerated successfully

**Database Migration:** ⏸️ Not applied yet (database not running)

To apply the migration when database is ready:
```bash
npm run prisma:migrate -- --name add_templates_and_zotero
```

## Backward Compatibility

✅ **Fully backward compatible**
- All new fields are nullable
- Existing projects continue to work (templateId = null)
- Existing users continue to work (no Zotero connection)
- No breaking API changes

## Next Steps

### Immediate (Database Setup)
1. Start PostgreSQL database
2. Run migration: `npm run prisma:migrate -- --name add_templates_and_zotero`
3. Verify migration succeeded
4. Test that existing data still loads

### Phase 3 (Implementation)
Following the incremental approach we agreed on:

**Phase 3a: Templates Module**
- Domain layer (Template, TemplateVersion entities)
- Application layer (CreateTemplate, ListTemplates, GetTemplateVersion use cases)
- Infra layer (TemplateRepoPrisma, template file storage)
- Delivery layer (HTTP routes, DTOs)

**Phase 3b: Zotero Module**
- Domain layer (ZoteroConnection, SyncLog entities)
- Application layer (ConnectZotero, SyncBibliography use cases)
- Infra layer (ZoteroClientHttp, ZoteroRepoPrisma)
- Delivery layer (OAuth callback, sync endpoints)

**Phase 3c: Update Project Creation**
- Add template selection to project creation flow
- Copy template files to new project
- Store template relationship

## Documentation

Created comprehensive documentation:
- `docs/SCHEMA_V2.md` — Full schema reference with use cases, migration guide, security considerations
- `docs/PHASE2_SUMMARY.md` — This file

## Review Checklist

Before proceeding to Phase 3:
- [ ] Review the new schema in `prisma/schema.prisma`
- [ ] Review `docs/SCHEMA_V2.md` for detailed documentation
- [ ] Confirm the scope matches your requirements
- [ ] Confirm no review workflow models were added (as agreed)
- [ ] Start PostgreSQL and apply migration
- [ ] Verify existing data still works after migration

## Questions for Review

1. **Template storage:** Should template files be stored in `var/templates/` or reuse `var/storage/`?
2. **Zotero tokens:** Should we add encryption now or defer to production hardening?
3. **Template seeding:** Do you want me to create seed data for initial templates?
4. **Module order:** Proceed with Templates first, then Zotero? Or different order?

---

**Status:** Schema V2 design complete ✅  
**Next:** Database migration + Phase 3 implementation
