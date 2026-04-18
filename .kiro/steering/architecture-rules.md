---
inclusion: always
---

# Architecture Rules

This project must follow **Modular Monolith + Clean Architecture**.

## Architectural style
- Organize backend by vertical modules under `src/modules/`
- Each module follows:
  - `domain`
  - `application`
  - `infra`
  - `delivery/http`
  - `delivery/ws` (only if needed)

## Dependency direction
- `delivery -> application -> domain`
- `infra -> domain/application` only through ports/interfaces
- `domain` must NOT import Fastify, Prisma, Zod, bcrypt, JWT, or any framework
- `application` must NOT import Fastify, Prisma, or delivery
- `delivery` must NOT query the database directly

## Layer responsibilities
- `domain`: entities, types, ports, policies, domain errors
- `application`: use cases, commands, orchestration, result types
- `infra`: Prisma repositories, hashing adapters, JWT adapters, compiler adapters
- `delivery/http`: routes, DTOs, validation, HTTP mapping
- `plugins`: framework wiring only
- `shared`: generic helpers only, no module business logic

## Composition
- Wire dependencies centrally
- Do not create heavy dependencies repeatedly inside handlers

## API discipline
- `delivery` validates input
- `application` returns typed results
- `delivery` maps results to HTTP responses

## Naming conventions
- File: PascalCase
- Class/Type/Interface/Enum: PascalCase
- Function/variable: camelCase

## Hard rules
- Do not generate Express code
- Do not generate NestJS code
- Do not generate Mongoose-based repositories
- Do not place Prisma queries outside `infra`
- Do not invent a new architecture when extending an existing module

## Working style
Before writing code, always reason about:
1. Target module
2. Target layer
3. Affected files
4. Why those files belong to that layer
