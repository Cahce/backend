---
inclusion: always
---

# Database Evolution Rules

Kiro may analyze and propose database redesign **only** when the current schema is incomplete or inconsistent with domain rules.

## Allowed reasons for schema redesign
- Missing entities or relationships
- Wrong cardinality
- Missing unique constraints
- Missing indexes for important queries
- Wrong lifecycle/status modeling
- Missing audit/history fields
- Poor separation between bounded contexts
- Schema does not support required use cases cleanly

## Constraints
- Do NOT change schema silently
- Do NOT redesign database for style preference alone
- Prefer minimal schema changes that improve correctness
- Keep schema aligned with module boundaries
- Update Prisma schema, repositories, DTOs, and use cases consistently

## Mandatory mindset
Before changing Prisma schema, always think through:
1. Current problem
2. Proposed schema changes
3. Affected modules/use cases
4. Migration impact
5. Data backfill or compatibility concerns
6. API contract impact
7. Rollback strategy

## Hybrid-editor-aware schema review
When evaluating schema adequacy, also check whether the database supports:
- persisted editor document state
- file versioning or snapshots
- compile job tracking
- compiled artifacts
- collaboration/session metadata
- autosave checkpoints when needed
- traceability between edited source and compiled outputs
