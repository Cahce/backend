---
name: plan-backend-implementation
description: Use when planning a backend implementation, refactor, or bugfix in this project. Determines target module, target layer, affected files, and reasons before code changes.
---

# Plan Backend Implementation

## Purpose
Use this skill before implementing backend code in this workspace.

## Workflow
1. Identify the target module
2. Identify the target layer
3. List the files that should change
4. Explain why each file belongs to that layer
5. Check whether the task impacts:
   - DTOs
   - use cases
   - repositories
   - schema
   - compile flow
   - editor hybrid behavior

## Output format
Return the plan in this exact structure:

### Implementation plan
- Target module:
- Target layer:
- Affected files:
- Layer reasoning:
- Database impact:
- API contract impact:
- Hybrid editor impact:
- Risks:

## Hard rules
- Do not start coding before identifying the correct layer
- Do not place business logic in delivery/routes
- Do not put Prisma queries outside infra
- Do not use framework imports in domain/application
- If the task appears to cross bounded contexts, call it out explicitly
