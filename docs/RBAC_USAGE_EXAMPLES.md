# RBAC Usage Examples

This document provides practical examples of using the RBAC system in route handlers.

## Import Required Types

```typescript
import type { FastifyInstance } from "fastify";
import type { UserRole } from "../../shared/auth/Types.js";
```

## Example 1: Admin-Only Route

Use `app.auth.requireAdmin` for routes that only admins should access:

```typescript
export async function adminRoutes(app: FastifyInstance) {
    // Only admin can create faculties
    app.post(
        "/faculties",
        {
            preHandler: app.auth.requireAdmin,
            schema: {
                description: "Tạo khoa mới",
                tags: ["admin-faculties"],
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
            },
        },
        async (request, reply) => {
            // Implementation
        }
    );
}
```

## Example 2: Multi-Role Route

Use `app.auth.requireRoles([...])` for routes accessible by multiple roles:

```typescript
export async function projectRoutes(app: FastifyInstance) {
    // Admin and teacher can view all projects
    app.get(
        "/projects",
        {
            preHandler: app.auth.requireRoles(["admin", "teacher"]),
            schema: {
                description: "Lấy danh sách dự án",
                tags: ["projects"],
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
            },
        },
        async (request, reply) => {
            const userRole = request.user.role; // Typed as UserRole
            
            // You can check role in handler if needed
            if (userRole === "admin") {
                // Admin-specific logic
            } else if (userRole === "teacher") {
                // Teacher-specific logic
            }
        }
    );
}
```

## Example 3: Authenticated Route (Any Role)

Use `app.auth.verify` for routes accessible by any authenticated user:

```typescript
export async function authRoutes(app: FastifyInstance) {
    // Any authenticated user can get their own profile
    app.get(
        "/me",
        {
            preHandler: app.auth.verify,
            schema: {
                description: "Lấy thông tin người dùng hiện tại",
                tags: ["auth"],
                security: [{ bearerAuth: [] }],
                response: {
                    401: {
                        description: "Chưa đăng nhập hoặc token không hợp lệ",
                        // ... error schema
                    },
                },
            },
        },
        async (request, reply) => {
            const userId = request.user.sub;
            const userRole = request.user.role; // Typed as UserRole
            const userEmail = request.user.email;
            
            // All authenticated users can access
        }
    );
}
```

## Example 4: Public Route (No Auth)

For public routes, simply don't add any `preHandler`:

```typescript
export async function publicRoutes(app: FastifyInstance) {
    // Public health check
    app.get(
        "/health",
        {
            schema: {
                description: "Kiểm tra trạng thái hệ thống",
                tags: ["health"],
                // No security requirement
            },
        },
        async (request, reply) => {
            return { status: "ok" };
        }
    );
}
```

## Example 5: Conditional Logic Based on Role

```typescript
export async function dashboardRoutes(app: FastifyInstance) {
    app.get(
        "/dashboard",
        {
            preHandler: app.auth.verify,
            schema: {
                description: "Lấy dữ liệu dashboard theo vai trò",
                tags: ["dashboard"],
                security: [{ bearerAuth: [] }],
            },
        },
        async (request, reply) => {
            const role = request.user.role;
            
            switch (role) {
                case "admin":
                    // Return admin dashboard data
                    return {
                        type: "admin",
                        stats: {
                            totalUsers: 100,
                            totalProjects: 500,
                        },
                    };
                    
                case "teacher":
                    // Return teacher dashboard data
                    return {
                        type: "teacher",
                        stats: {
                            myStudents: 30,
                            advisedProjects: 15,
                        },
                    };
                    
                case "student":
                    // Return student dashboard data
                    return {
                        type: "student",
                        stats: {
                            myProjects: 3,
                            sharedProjects: 2,
                        },
                    };
                    
                default:
                    // TypeScript will catch this if you forget a role
                    const _exhaustive: never = role;
                    return reply.code(500).send({ error: "Unknown role" });
            }
        }
    );
}
```

## Example 6: Multiple PreHandlers

You can combine multiple preHandlers if needed:

```typescript
export async function advancedRoutes(app: FastifyInstance) {
    // Custom validation preHandler
    async function validateProjectId(req: FastifyRequest, reply: FastifyReply) {
        const projectId = (req.params as any).projectId;
        if (!projectId || projectId.length < 10) {
            return reply.code(400).send({
                error: {
                    code: "INVALID_PROJECT_ID",
                    message: "ID dự án không hợp lệ",
                },
            });
        }
    }
    
    app.get(
        "/projects/:projectId",
        {
            // Multiple preHandlers run in order
            preHandler: [
                app.auth.requireRoles(["admin", "teacher"]),
                validateProjectId,
            ],
            schema: {
                description: "Lấy chi tiết dự án",
                tags: ["projects"],
                security: [{ bearerAuth: [] }],
            },
        },
        async (request, reply) => {
            // Both auth and validation passed
        }
    );
}
```

## Type Safety Benefits

The strongly-typed `UserRole` provides:

1. **Autocomplete**: IDE suggests valid roles
2. **Compile-time checks**: Typos are caught at build time
3. **Exhaustiveness checking**: Switch statements must handle all roles
4. **Refactoring safety**: Renaming a role updates all usages

```typescript
// ✅ Valid
app.auth.requireRoles(["admin", "teacher"])

// ❌ TypeScript error: "admn" is not assignable to UserRole
app.auth.requireRoles(["admn", "teacher"])

// ✅ Type-safe access
const role: UserRole = request.user.role;

// ❌ TypeScript error: string is not assignable to UserRole
const role: UserRole = "invalid_role";
```

## Error Response Format

All auth guards return consistent error responses:

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

## Best Practices

1. **Use the most restrictive guard**: Start with `requireAdmin`, only relax to `requireRoles` if needed
2. **Document role requirements**: Add clear descriptions in OpenAPI schema
3. **Keep authorization in delivery layer**: Don't move role checks into use cases
4. **Use type-safe role constants**: Import `UserRole` type, don't use strings
5. **Handle all roles in switches**: Use exhaustiveness checking for safety

## Common Patterns

### Pattern 1: Admin-only CRUD
```typescript
// All admin CRUD operations
preHandler: app.auth.requireAdmin
```

### Pattern 2: Teacher + Admin Management
```typescript
// Teachers can view, only admin can modify
GET:    preHandler: app.auth.requireRoles(["admin", "teacher"])
POST:   preHandler: app.auth.requireAdmin
PUT:    preHandler: app.auth.requireAdmin
DELETE: preHandler: app.auth.requireAdmin
```

### Pattern 3: User-specific Resources
```typescript
// Any authenticated user, check ownership in handler
preHandler: app.auth.verify

// Then in handler:
if (resource.ownerId !== request.user.sub && request.user.role !== "admin") {
    return reply.code(403).send({ error: "Not authorized" });
}
```

## Migration Guide

If you have existing routes using string-based role checks:

### Before
```typescript
if (request.user.role !== "admin") {
    return reply.code(403).send({ error: "Forbidden" });
}
```

### After
```typescript
// Use preHandler instead
preHandler: app.auth.requireAdmin

// Or for multi-role:
preHandler: app.auth.requireRoles(["admin", "teacher"])
```

This moves authorization to the framework layer where it belongs.
