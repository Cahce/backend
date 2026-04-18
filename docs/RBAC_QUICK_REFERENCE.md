# RBAC Quick Reference

Quick reference for using role-based authorization in routes.

## Import

```typescript
import type { FastifyInstance } from "fastify";
```

## Route Guards

### Admin Only
```typescript
preHandler: app.auth.requireAdmin
```

### Multiple Roles
```typescript
preHandler: app.auth.requireRoles(["admin", "teacher"])
preHandler: app.auth.requireRoles(["admin", "teacher", "student"])
```

### Any Authenticated User
```typescript
preHandler: app.auth.verify
```

### No Authentication (Public)
```typescript
// No preHandler
```

## Accessing User Info

```typescript
async (request, reply) => {
    const userId = request.user.sub;        // string
    const userEmail = request.user.email;   // string
    const userRole = request.user.role;     // UserRole ("admin" | "teacher" | "student")
    const jti = request.user.jti;           // string (token ID)
}
```

## OpenAPI Schema

### Admin-Only Endpoint
```typescript
schema: {
    security: [{ bearerAuth: [] }],
    response: {
        401: {
            description: "Chưa đăng nhập hoặc token không hợp lệ",
            // ... error schema
        },
        403: {
            description: "Không có quyền truy cập (chỉ admin)",
            // ... error schema
        },
    },
}
```

### Multi-Role Endpoint
```typescript
schema: {
    security: [{ bearerAuth: [] }],
    response: {
        401: {
            description: "Chưa đăng nhập hoặc token không hợp lệ",
            // ... error schema
        },
        403: {
            description: "Không có quyền truy cập (chỉ admin và giáo viên)",
            // ... error schema
        },
    },
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Chưa đăng nhập hoặc token không hợp lệ"
  }
}
```

### 403 Forbidden
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Không có quyền truy cập"
  }
}
```

## Role Constants

```typescript
import { UserRole } from "../../shared/auth/Types.js";

// Use in code
if (request.user.role === "admin") { }
if (request.user.role === "teacher") { }
if (request.user.role === "student") { }

// Or use constants
if (request.user.role === UserRole.ADMIN) { }
if (request.user.role === UserRole.TEACHER) { }
if (request.user.role === UserRole.STUDENT) { }
```

## Common Patterns

| Pattern | Guard | Description |
|---------|-------|-------------|
| Admin CRUD | `requireAdmin` | Only admin can create/update/delete |
| View All | `requireRoles(["admin", "teacher"])` | Admin and teacher can view |
| Own Resources | `verify` | Any user, check ownership in handler |
| Public | No guard | No authentication required |

## Complete Example

```typescript
export async function exampleRoutes(app: FastifyInstance) {
    // Admin only
    app.post(
        "/admin/users",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tạo người dùng mới",
                tags: ["admin"],
                security: [{ bearerAuth: [] }],
                response: {
                    401: { description: "Chưa đăng nhập" },
                    403: { description: "Chỉ admin" },
                },
            },
        },
        async (request, reply) => {
            // Only admin can access
        }
    );

    // Admin and teacher
    app.get(
        "/reports",
        {
            preHandler: app.auth.requireRoles(["admin", "teacher"]),
            schema: {
                description: "Xem báo cáo",
                tags: ["reports"],
                security: [{ bearerAuth: [] }],
                response: {
                    401: { description: "Chưa đăng nhập" },
                    403: { description: "Chỉ admin và giáo viên" },
                },
            },
        },
        async (request, reply) => {
            // Admin and teacher can access
        }
    );

    // Any authenticated user
    app.get(
        "/profile",
        {
            preHandler: app.auth.verify,
            schema: {
                description: "Xem hồ sơ cá nhân",
                tags: ["profile"],
                security: [{ bearerAuth: [] }],
                response: {
                    401: { description: "Chưa đăng nhập" },
                },
            },
        },
        async (request, reply) => {
            const userId = request.user.sub;
            // Any authenticated user can access
        }
    );

    // Public
    app.get(
        "/health",
        {
            schema: {
                description: "Kiểm tra trạng thái",
                tags: ["health"],
            },
        },
        async (request, reply) => {
            return { status: "ok" };
        }
    );
}
```

## Testing

```bash
# Build
npm run build

# Run authorization tests
npx tsx scripts/test-non-admin-access.ts
```

## Documentation

- Full details: `docs/RBAC_IMPLEMENTATION.md`
- Usage examples: `docs/RBAC_USAGE_EXAMPLES.md`
- Summary: `docs/RBAC_COMPLETE.md`
