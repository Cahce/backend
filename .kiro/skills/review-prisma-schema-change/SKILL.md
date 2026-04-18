---
name: review-prisma-schema-change
description: Use when reviewing or planning changes to Prisma schema in this project. Produces a structured schema-change analysis before any database modification.
---

# Review Prisma Schema Change

## Purpose
Use this skill before touching `prisma/schema.prisma` or when reviewing a schema change.

## Mandatory analysis
Always produce all of the following:
1. Current problem
2. Proposed schema changes
3. Affected modules/use cases
4. Migration impact
5. Data backfill or compatibility concerns
6. API contract impact
7. Rollback strategy

## Extra checks for this project
Also evaluate whether the schema supports:
- persisted editor source state
- compile job tracking
- artifacts
- snapshots/versioning
- collaboration/session metadata
- traceability from source to output artifact

## Output format
### Schema review
- Current problem:
- Proposed changes:
- Affected modules/use cases:
- Migration impact:
- Compatibility/backfill:
- API impact:
- Rollback:
- Recommendation:

## Hard rules
- Do not recommend schema changes for style preference alone
- Prefer minimal schema changes
- Keep schema aligned with module boundaries
- Call out all downstream code that must change: repos, DTOs, use cases, tests
