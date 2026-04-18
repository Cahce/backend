# RBAC Implementation

**Date**: April 18, 2026  
**Status**: ✅ COMPLETE

## Summary

Implemented basic role-based authorization (RBAC) for the Fastify backend following clean architecture principles. This provides strongly-typed role guards for HTTP routes without introducing a complex permission system.

## Implementation Details

### 1. Strongly Typed Roles

Created `src/shared/auth/Types.ts` to re-export and provide utilities for the `UserRole` type from Prisma:

```typescript
export type UserRole = PrismaUserRole; // "admin" | "teacher" | "student"

export const UserRole = {
    ADMIN: "admin" as const,
    TEACHER: "teacher" as const,
    STUDENT: "student" as const,
} as const;
```

### 2. Updated Fastify Type Declarations

Updated `src/types/fastify.d.ts` to:
- Use `UserRole` instead of `string` for JWT payload and user
- Add proper return types (`Promise<void>` instead of `Promise<unknown>`)
- Add `requireRoles` function to `app.auth`
- Import `FastifyRequest` and `FastifyReply` types

```typescript
interface FastifyInstance {
    auth: {
        verify: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
        requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
        requireRoles: (roles: UserRole[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    };
}
```

### 3. Improved JWT Plugin

Updated `src/plugins/JWT.ts` with:

**`verify` function**:
- Verifies JWT token
- Checks token revocation
- Returns 401 with Vietnamese error messages

**`requireRoles` function**:
- Accepts array of allowed roles
- First calls `verify` to authenticate
- Then checks if user role matches one of the allowed roles
- Returns 403 if role not allowed

**`requireAdmin` function**:
- Convenience wrapper around `requireRoles(["admin"])`
- Maintains backward compatibility

### 4. Updated Domain Types

Updated `src/modules/auth/domain/Ports.ts`:
- Changed `UserDto.role` from `"admin" | "student" | "teacher"` to `UserRole`
- Changed `ITokenService.generate` payload to use `UserRole`

Updated `src/modules/auth/infra/JwtTokenServiceFastify.ts`:
- Updated to use `UserRole` type

## Usage Examples

### Admin-Only Route
```typescript
app.post(
    "/faculties",
    {
        preHandler: app.auth.requireAdmin,
        // ... schema
    },
    async (request, reply) => {
        // Only admin can access
    }
);
```

### Multi-Role Route
```typescript
app.get(
    "/projects",
    {
        preHandler: app.auth.requireRoles(["admin", "teacher"]),
        // ... schema
    },
    async (request, reply) => {
        // Admin and teacher can access
    }
);
```

### Authenticated Route (Any Role)
```typescript
app.get(
    "/me",
    {
        preHandler: app.auth.verify,
        // ... schema
    },
    async (request, reply) => {
        // Any authenticated user can access
        const role = request.user.role; // Strongly typed as UserRole
    }
);
```

## Current Route Protection

All admin endpoints already use `app.auth.requireAdmin`:
- ✅ Faculty CRUD (5 endpoints)
- ✅ Department CRUD (5 endpoints)
- ✅ Major CRUD (5 endpoints)
- ✅ Class CRUD (5 endpoints)
- ✅ Teacher Management (7 endpoints)
- ✅ Student Management (7 endpoints)

**Total**: 34 admin-protected endpoints

## Error Responses

### 401 Unauthorized
Returned when:
- JWT token is missing or invalid
- JWT token has been revoked
- Token is missing JTI

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Chưa đăng nhập hoặc token không hợp lệ"
  }
}
```

### 403 Forbidden
Returned when:
- User is authenticated but doesn't have required role

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Không có quyền truy cập"
  }
}
```

## Architecture Compliance

✅ **Follows Clean Architecture**:
- RBAC logic stays in delivery/plugin layer (framework concern)
- Domain layer remains framework-agnostic
- Application layer doesn't handle authorization
- Infra layer only implements ports

✅ **Type Safety**:
- No `role: string` anywhere
- All roles are strongly typed as `UserRole`
- JWT payload and user are properly typed

✅ **Backward Compatible**:
- Existing `verify` and `requireAdmin` work unchanged
- All existing routes continue to function
- No breaking changes to auth flow

## Files Modified

1. **Created**:
   - `src/shared/auth/Types.ts` - Shared UserRole type and utilities

2. **Updated**:
   - `src/types/fastify.d.ts` - Strongly typed auth decorations
   - `src/plugins/JWT.ts` - Improved guards with requireRoles
   - `src/modules/auth/domain/Ports.ts` - UserRole in domain interfaces
   - `src/modules/auth/infra/JwtTokenServiceFastify.ts` - UserRole in token generation

## Testing

### Build Verification
```bash
npm run build
```
✅ **SUCCESS** - No TypeScript errors

### Existing Tests
All existing authorization tests continue to pass:
- Admin can access admin endpoints (200 OK)
- Teacher gets 403 Forbidden for admin operations
- Student gets 403 Forbidden for admin operations
- All roles can access auth endpoints

Test script: `scripts/test-non-admin-access.ts`

## Future Enhancements

This implementation provides the foundation for:
- Resource-level authorization (ownership checks)
- Permission-based access control (if needed)
- Role hierarchy (if needed)
- Audit logging of authorization failures

However, these are NOT implemented as they're outside the current scope.

## Hard Rules Followed

✅ Did NOT create a new authorization framework  
✅ Did NOT add database permission tables  
✅ Did NOT move RBAC into domain/application  
✅ Did NOT use `role: string`  
✅ Did NOT introduce circular dependencies  
✅ Kept naming and file organization consistent  
✅ Did NOT touch JWT/session logic unnecessarily  
✅ Did NOT remove local password login flow  

## Conclusion

Basic RBAC is now implemented with:
- Strong typing for roles
- Clean separation of concerns
- Extensible `requireRoles` function
- Backward compatibility
- Vietnamese error messages
- Full type safety

The system is ready for feature development with proper role-based authorization.
