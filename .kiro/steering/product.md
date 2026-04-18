# Product Overview

This workspace focuses on the **backend API server** of a collaborative Typst document editing platform — conceptually similar to Overleaf, but built for **Typst**.

The overall product uses a **hybrid editor model**:
- the frontend is responsible for low-latency editing experience and fast preview
- the backend is responsible for authoritative persistence, collaboration, security, and official compile/export behavior

This backend must remain the **source of truth** for:
- authentication and authorization
- project/file persistence
- collaboration state synchronization
- official compilation/export results
- artifacts, quotas, analytics, and system-level policies

## Core Capabilities

- User authentication
  - local credentials
  - token-based session handling
  - optional future SSO integration (LDAP / Google)
- Role-based access with `admin`, `teacher`, and `student`
- Project management with file storage
  - Typst source files
  - images
  - bibliographies
  - data files
- Typst document compilation
  - preview-oriented compile flow
  - official export / artifact generation
  - compile status tracking
- Project collaboration
  - membership
  - sharing model
  - synchronized editing support
- Teacher advising relationship over student projects
- Citation / bibliography integration
- Project snapshots and writing analytics
- Per-user storage quota enforcement
- JWT-based authentication with token revocation
- Swagger / OpenAPI documentation

## Product Principles

- The backend is not a generic CRUD API; it is the authoritative service layer for a Typst editing platform
- The editor is hybrid, but final correctness must be enforced by the backend
- Backend changes must preserve modular monolith + clean architecture boundaries
- Schema evolution is allowed only when it supports real use cases more correctly