---
name: review-architecture-boundary
description: Use when reviewing a backend file, refactor, or generated code for clean architecture boundary violations in this project.
---

# Review Architecture Boundary

## Purpose
Use this skill to verify that backend code respects modular monolith and clean architecture boundaries.

## What to check
1. Is the file in the correct module?
2. Is the file in the correct layer?
3. Are imports aligned with dependency direction?
4. Is framework leakage happening in domain/application?
5. Is delivery doing business logic or direct DB access?
6. Is infra implementing ports correctly?
7. Are naming conventions respected?

## Output format
### Boundary review
- File/module:
- Expected layer:
- Actual issues:
- Dependency violations:
- Framework leakage:
- Naming issues:
- Minimal safe fix:

## Hard rules
- Do not suggest large rewrites unless necessary
- Prefer the smallest structural correction
- Preserve existing architecture instead of inventing a new one
