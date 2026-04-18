# Swagger/OpenAPI Fix - Zod as Single Source of Truth

## Problem

The Swagger UI was rendering request bodies as plain "string" instead of structured JSON objects for auth endpoints. This was caused by **abandoning the Zod-to-OpenAPI approach** and replacing it with manually maintained JSON Schema definitions.

## Root Cause

The implementation had:
1. **Duplicated schema definitions**: Zod schemas in `Dto.ts` for runtime validation + manual JSON schemas in `Routes.ts` for Swagger
2. **Violated single source of truth**: Two separate definitions that could drift out of sync
3. **Not using installed libraries**: `@asteasolutions/zod-to-openapi` and `zod-to-json-schema` were installed but unused
4. **Maintenance burden**: Every schema change required updating 2+ places

## Solution

Restored Zod as the single source of truth by:

### 1. Enhanced Zod Schemas with OpenAPI Metadata (`Dto.ts`)

```typescript
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

// Add OpenAPI metadata using .openapi()
export const LoginRequestSchema = z
    .object({
        email: z
            .string()
            .min(1, "Email là bắt buộc")
            .email("Định dạng email không hợp lệ")
            .openapi({
                description: "Email đăng nhập (phải sử dụng @tlu.edu.vn hoặc @e.tlu.edu.vn)",
                example: "2251172560@e.tlu.edu.vn",
            }),
        password: z
            .string()
            .min(1, "Mật khẩu là bắt buộc")
            .openapi({
                description: "Mật khẩu",
                example: "123456",
            }),
    })
    .openapi("LoginRequest");
```

### 2. Converted Zod Schemas to JSON Schema (`Routes.ts`)

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";

// Helper function to convert Zod schemas
function toJsonSchema(schema: any, name: string) {
    return zodToJsonSchema(schema, name);
}

// Use in route definitions
app.post("/login", {
    schema: {
        body: toJsonSchema(LoginRequestSchema, "LoginRequest"),
        response: {
            200: toJsonSchema(LoginResponseSchema, "LoginResponse"),
            400: toJsonSchema(ErrorResponseSchema, "ErrorResponse"),
        },
    },
});
```

### 3. Removed Manual JSON Schema Definitions

Deleted the entire `schemas` constant object (150+ lines) from `Routes.ts` that contained manually maintained JSON schemas.

## Benefits

✅ **Single source of truth**: Zod schemas define both validation and documentation  
✅ **No duplication**: Schema defined once, used everywhere  
✅ **Type safety**: TypeScript validates Zod schemas  
✅ **Easy maintenance**: Add field once, docs update automatically  
✅ **No drift**: Validation and docs always in sync  
✅ **Vietnamese support**: All descriptions and examples preserved  

## Files Changed

### Modified Files

1. **`src/modules/auth/delivery/http/Dto.ts`**
   - Added `extendZodWithOpenApi(z)` import and call
   - Added `.openapi()` metadata to all Zod schemas
   - Added Vietnamese descriptions and examples
   - All schemas now have OpenAPI metadata

2. **`src/modules/auth/delivery/http/Routes.ts`**
   - Added `zodToJsonSchema` import
   - Added `toJsonSchema()` helper function
   - Replaced all manual JSON schemas with `toJsonSchema()` calls
   - Removed 150+ lines of manual schema definitions
   - Restored imports of all response schemas

## Verification

### Build Status
✅ TypeScript compilation successful (`npm run build`)

### Runtime Status
✅ Server starts without errors  
✅ Swagger UI accessible at `http://localhost:3000/docs`

### Test Results
✅ All 11 auth tests passing (`npm run test:api:auth`)
- Login with valid credentials
- Get current user
- Change password (multiple scenarios)
- Logout and token revocation
- Error handling

### Swagger UI Rendering

**Before Fix:**
- Request body showed as plain "string"
- No structured object visible
- No examples shown

**After Fix:**
- Request body shows structured JSON object
- All fields visible with types
- Vietnamese descriptions displayed
- Examples shown for all endpoints

## Example Swagger Output

### POST /api/v1/auth/login

**Request Body:**
```json
{
  "email": "2251172560@e.tlu.edu.vn",
  "password": "123456"
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cmnztabnn0000e8vmyzb8gqtn",
    "email": "admin@tlu.edu.vn",
    "role": "admin"
  }
}
```

### POST /api/v1/auth/change-password

**Request Body:**
```json
{
  "oldPassword": "123456",
  "newPassword": "MatKhauMoi@123",
  "confirmNewPassword": "MatKhauMoi@123"
}
```

**Response 200:**
```json
{
  "message": "Đổi mật khẩu thành công"
}
```

## Architecture Compliance

✅ **Modular Monolith**: Changes isolated to auth module  
✅ **Clean Architecture**: Delivery layer only affected  
✅ **Single Source of Truth**: Zod schemas define everything  
✅ **No Business Logic Changes**: Only documentation layer updated  
✅ **Vietnamese Support**: All messages preserved  
✅ **Type Safety**: Full TypeScript validation  

## Technical Stack Used

- **Zod v4.3.6**: Schema definition and validation
- **@asteasolutions/zod-to-openapi v8.4.3**: OpenAPI metadata extension
- **zod-to-json-schema v3.25.1**: Zod to JSON Schema conversion
- **@fastify/swagger v9.7.0**: OpenAPI documentation
- **@fastify/swagger-ui v5.2.5**: Swagger UI rendering

## Future Maintenance

When adding new endpoints:

1. Define Zod schema in `Dto.ts` with `.openapi()` metadata
2. Use `toJsonSchema()` in `Routes.ts` to convert for Fastify
3. No manual JSON schema needed
4. Validation and docs stay in sync automatically

## Conclusion

The fix successfully restored Zod as the single source of truth for API contracts, eliminating duplication and ensuring validation and documentation remain synchronized. All Vietnamese content is preserved, and Swagger UI now correctly renders structured JSON objects for all auth endpoints.
