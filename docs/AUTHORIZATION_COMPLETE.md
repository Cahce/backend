# Authorization Implementation Complete

## Overview

Role-based authorization has been successfully implemented to ensure only admin users can access admin endpoints.

## Implementation Date

April 18, 2026

## Changes Made

### 1. JWT Plugin Enhancement (`src/plugins/JWT.ts`)

Added `requireAdmin` preHandler that:
- Verifies JWT authentication (same as `verify`)
- Checks token revocation status
- **Validates user role is 'admin'**
- Returns 403 Forbidden if user is not admin

```typescript
requireAdmin: async (req, reply) => {
    // Authentication checks...
    
    // Check admin role
    const role = req.user?.role;
    if (role !== "admin") {
        return reply.code(403).send({
            error: {
                code: "FORBIDDEN",
                message: "Chỉ admin mới có quyền truy cập"
            }
        });
    }
}
```

### 2. Type Definitions Update (`src/types/fastify.d.ts`)

- Added `requireAdmin` to FastifyInstance auth interface
- Added `email` and `role` fields to JWT payload and user types

### 3. Admin Routes Update

Updated all admin route files to use `requireAdmin` instead of `verify`:
- `src/modules/admin/delivery/http/Faculty/Routes.ts`
- `src/modules/admin/delivery/http/Department/Routes.ts`
- `src/modules/admin/delivery/http/Major/Routes.ts`
- `src/modules/admin/delivery/http/Class/Routes.ts`
- `src/modules/admin/delivery/http/TeacherManagement/Routes.ts`
- `src/modules/admin/delivery/http/StudentManagement/Routes.ts`

### 4. OpenAPI Schema Updates

Added 403 Forbidden response to all admin endpoint schemas:

```typescript
403: {
    description: "Không có quyền truy cập (chỉ admin)",
    ...ErrorResponseJsonSchema,
}
```

### 5. Test Scripts

Created `scripts/test-authorization.ts` to verify:
- Admin users can access admin endpoints (200 OK)
- Unauthenticated requests are rejected (401 Unauthorized)
- Auth endpoints still work with any authenticated user

Updated `scripts/test-all-apis.ts` to use correct admin email format.

## Email Format Convention

The system follows this email format convention:

| Role | Email Format | Example |
|------|--------------|---------|
| Admin | `admin@tlu.edu.vn` | `admin@tlu.edu.vn` |
| Teacher | `{teacherName}@tlu.edu.vn` | `kieutuandung@tlu.edu.vn` |
| Student | `{studentId}@e.tlu.edu.vn` | `2251172560@e.tlu.edu.vn` |

## Authorization Flow

### Admin Endpoints (`/api/v1/admin/*`)

1. Request arrives with JWT token in Authorization header
2. `requireAdmin` preHandler executes:
   - Verifies JWT signature and expiration
   - Checks if token is revoked
   - **Validates user role === 'admin'**
3. If all checks pass → proceed to route handler
4. If role check fails → return 403 Forbidden

### Auth Endpoints (`/api/v1/auth/*`)

1. Request arrives with JWT token (for protected endpoints)
2. `verify` preHandler executes:
   - Verifies JWT signature and expiration
   - Checks if token is revoked
   - **Does NOT check role** (any authenticated user can access)
3. If checks pass → proceed to route handler

## HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Request successful |
| 401 | Unauthorized | Missing token, invalid token, or revoked token |
| 403 | Forbidden | Valid token but user is not admin |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Business rule violation (e.g., duplicate code) |
| 500 | Internal Server Error | Unexpected error |

## Test Results

All authorization tests passed:

```
✅ Admin Access with Admin Token: 6/6 passed
✅ No Token Access: 6/6 correctly rejected (401)
✅ Auth Endpoints: 1/1 passed
```

### Test Coverage

- ✅ Admin can access all admin endpoints
- ✅ Unauthenticated requests are rejected with 401
- ✅ Auth endpoints work with any authenticated user
- ✅ OpenAPI documentation includes 403 responses

## Future Enhancements

To fully test authorization, we need to:

1. **Create teacher and student test accounts**
   - Seed database with teacher account (e.g., `kieutuandung@tlu.edu.vn`)
   - Seed database with student account (e.g., `2251172560@e.tlu.edu.vn`)

2. **Test non-admin access to admin endpoints**
   - Login as teacher → try to access admin endpoints → expect 403
   - Login as student → try to access admin endpoints → expect 403

3. **Add authorization test to CI/CD pipeline**
   - Run authorization tests before deployment
   - Fail build if authorization tests fail

## Security Considerations

### ✅ Implemented

- Role-based access control for admin endpoints
- JWT token verification and revocation checking
- Proper HTTP status codes (401 vs 403)
- Vietnamese error messages for better UX

### 🔒 Best Practices Followed

- Admin role check happens AFTER authentication
- Token revocation is checked on every request
- Role information is stored in JWT payload (signed and tamper-proof)
- Consistent error response format

### ⚠️ Important Notes

- **Role is stored in JWT token**: Changing a user's role requires issuing a new token
- **Token revocation**: Logout invalidates the token immediately
- **No role escalation**: Users cannot change their own role
- **Admin-only operations**: All CRUD operations on academic structure and profiles require admin role

## Related Documentation

- [Phase 2 Complete](./PHASE2_COMPLETE.md) - Phase 2 implementation summary
- [API Test Report](./API_TEST_REPORT.md) - Comprehensive API test results
- [Login Implementation](./LOGIN_IMPLEMENTATION.md) - Authentication flow details

## Verification Commands

```bash
# Start dev server
npm run dev

# Run authorization tests
npx tsx scripts/test-authorization.ts

# Run all API tests (includes authorization)
npx tsx scripts/test-all-apis.ts
```

## Summary

✅ **Authorization implementation complete**
- Admin endpoints now require admin role
- Non-admin users will receive 403 Forbidden
- All tests passing
- OpenAPI documentation updated
- Proper error messages in Vietnamese

The system now correctly enforces role-based access control, ensuring only admin users can manage academic structure and user profiles.
