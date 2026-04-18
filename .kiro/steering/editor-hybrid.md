---
inclusion: always
---

# Hybrid Editor Architecture

The editor in this project must be implemented in a **hybrid** style.

## Meaning of hybrid editor
- It is NOT purely client-side
- It is NOT purely server-side
- Client handles low-latency editing experience
- Server handles authoritative persistence, collaboration sync, and official compilation/export

## Client-side editor responsibilities
- Monaco editor state and user interactions
- Cursor, selection, awareness UI
- Optimistic local editing behavior
- Fast preview when possible
- Debounced requests to backend
- Rendering diagnostics returned by backend

## Server-side editor responsibilities
- Authenticated collaboration sessions
- Document persistence
- File/version/snapshot lifecycle
- Authoritative compile pipeline
- Official preview/export generation
- Artifact storage
- Permission and quota enforcement

## Authoritative rules
- Local preview is fast feedback only
- Backend compile/export is the official result
- Saved state must be server-backed
- Collaboration state must eventually synchronize to the backend
- Frontend must not become the sole source of truth

## Feature design rule
For every editor-related feature, explicitly decide:
1. What must happen instantly on client
2. What must be synchronized to server
3. What must be compiled officially on server
4. What data contract connects both sides

## Compile split
- Fast preview may happen on the client
- Official compile/export must happen on the backend
- Backend diagnostics are authoritative for saved/exported state
- Client preview must not be treated as final artifact generation

## Fallback rule
- Prefer client-side preview for responsiveness
- Fall back to server-side compilation when correctness, large documents, templates, or export fidelity matter
- Final export must always be verified by the backend
