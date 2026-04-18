# Auth Module Implementation Complete

**Date:** 2026-04-15  
**Status:** ✅ Complete and Tested  
**Language:** Vietnamese error messages

---

## Overview

Implemented complete authentication flow for the auth module with all required features:
1. ✅ Login with email and password
2. ✅ Get current user from token
3. ✅ Logout and token revocation
4. ✅ Change password

All error messages are in Vietnamese as per requirements.

---

## API Endpoints

### 1. POST /api/v1/auth/login
**Description:** Đăng nhập bằng email và mật khẩu

**Request:**
```json
{
  "email": "admin@tlu.edu.vn",
  "password": "123456"
}
```

**Success Response (200):**
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

**Error Responses:**
- 400: Validation errors, invalid email format, unsupported domain
- 401: Invalid credentials
- 403: Account inactive
- 500: Internal error

### 2. GET /api/v1/auth/me
**Description:** Lấy thông tin người dùng hiện tại  
**Authentication:** Required (Bearer token)

**Success Response (200):**
```json
{
  "user": {
    "id": "cmnztabnn0000e8vmyzb8gqtn",
    "email": "admin@tlu.edu.vn",
    "role": "admin"
  }
}
```

**Error Responses:**
- 401: Unauthorized, token revoked
- 500: Internal error

### 3. POST /api/v1/auth/logout
**Description:** Đăng xuất và vô hiệu hóa token hiện tại  
**Authentication:** Required (Bearer token)

**Success Response (200):**
```json
{
  "message": "Đăng xuất thành công"
}
```

**Error Responses:**
- 401: Unauthorized
- 500: Internal error

### 4. POST /api/v1/auth/change-password
**Description:** Đổi mật khẩu  
**Authentication:** Required (Bearer token)

**Request:**
```json
{
  "oldPassword": "123456",
  "newPassword": "newpass123",
  "confirmNewPassword": "newpass123"
}
```

**Success Response (200):**
```json
{
  "message": "Đổi mật khẩu thành công"
}
```

**Error Responses:**
- 400: Validation errors, old password incorrect, passwords don't match, new password same as old
- 401: Unauthorized
- 500: Internal error

---

## Vietnamese Error Messages

| Error Code | Vietnamese Message |
|------------|-------------------|
| `INVALID_EMAIL_FORMAT` | Định dạng email không hợp lệ |
| `UNSUPPORTED_EMAIL_DOMAIN` | Tên miền email không được hỗ trợ. Vui lòng sử dụng @tlu.edu.vn hoặc @e.tlu.edu.vn |
| `INVALID_CREDENTIALS` | Email hoặc mật khẩu không đúng |
| `ACCOUNT_INACTIVE` | Tài khoản đã bị vô hiệu hóa |
| `UNAUTHORIZED` | Chưa xác thực |
| `OLD_PASSWORD_INCORRECT` | Mật khẩu cũ không đúng |
| `PASSWORDS_DO_NOT_MATCH` | Mật khẩu xác nhận không khớp |
| `NEW_PASSWORD_SAME_AS_OLD` | Mật khẩu mới phải khác mật khẩu cũ |
| `INTERNAL_ERROR` | Xác thực thất bại |

---

## Business Rules Implemented

### Login Rules
✅ Validate email format  
✅ Validate school domain (@tlu.edu.vn, @e.tlu.edu.vn)  
✅ Find user by email  
✅ Verify password using bcrypt  
✅ Read role from database  
✅ Issue JWT token with jti  
✅ Return Vietnamese messages  

### Change Password Rules
✅ Require oldPassword  
✅ Require newPassword  
✅ Require confirmNewPassword  
✅ Verify old password  
✅ New password must differ from old password  
✅ confirmNewPassword must match newPassword  

### Token Rules
✅ Login returns accessToken  
✅ Token includes jti for revocation  
✅ Swagger Bearer auth uses token  
✅ Logout invalidates current token  
✅ Revoked tokens cannot be reused  

---

## Architecture

### Files Created/Updated

**Domain Layer:**
- `AuthErrors.ts` — Updated with Vietnamese messages and new error types
- `EmailPolicy.ts` — Email validation (unchanged)
- `Ports.ts` — Updated with new interfaces

**Application Layer:**
- `LoginUseCase.ts` — Login logic (unchanged)
- `GetCurrentUserUseCase.ts` — NEW: Get current user
- `LogoutUseCase.ts` — NEW: Logout and token revocation
- `ChangePasswordUseCase.ts` — NEW: Change password

**Infrastructure Layer:**
- `UserRepoPrisma.ts` — Updated with findById and updatePassword
- `PasswordHasherBcrypt.ts` — Updated with hash method
- `JwtTokenServiceFastify.ts` — Token generation (unchanged)
- `TokenRevocationRepoPrisma.ts` — NEW: Token revocation repository

**Delivery Layer:**
- `Dto.ts` — Updated with new schemas and Vietnamese messages
- `Routes.ts` — Updated with all 4 endpoints

---

## Test Accounts

Default password: `123456`

| Email | Role | Domain |
|-------|------|--------|
| admin@tlu.edu.vn | admin | @tlu.edu.vn |
| kieutuandung@tlu.edu.vn | teacher | @tlu.edu.vn |
| 2251172560@e.tlu.edu.vn | student | @e.tlu.edu.vn |

---

## Testing

### Seed Users
```bash
npm run seed:users
```

### Run Auth Tests
```bash
npm run test:api:auth
```

### Manual Testing with Swagger
1. Go to http://localhost:3000/docs
2. POST /api/v1/auth/login to get token
3. Click "Authorize" button and enter: `Bearer <token>`
4. Test protected endpoints (GET /me, POST /logout, POST /change-password)

---

## Security Features

1. **Password Storage** — bcrypt with 10 rounds
2. **User Enumeration Prevention** — Same error for "not found" and "wrong password"
3. **Token Revocation** — Logout invalidates tokens in database
4. **JWT with JTI** — Each token has unique ID for revocation
5. **Email Normalization** — Lowercase before lookup
6. **Domain Validation** — Only school domains accepted
7. **Account Status Check** — Inactive accounts cannot login
8. **Password Change Validation** — Old password verified, new must be different

---

## Out of Scope (As Per Requirements)

❌ SSO integration  
❌ Refresh token redesign  
❌ Frontend auth UI  
❌ Password reveal in admin UI  

---

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Seed users
npm run seed:users

# Test auth endpoints
npm run test:api:auth

# Test login only
npm run test:api:login
```

---

## Swagger/OpenAPI

✅ All endpoints documented  
✅ Bearer authentication configured  
✅ Request/response schemas defined  
✅ Vietnamese descriptions  

Access at: http://localhost:3000/docs

---

## Clean Architecture Compliance

✅ **Domain layer** — No framework dependencies, Vietnamese error messages  
✅ **Application layer** — Depends only on domain ports  
✅ **Infrastructure layer** — Implements domain ports  
✅ **Delivery layer** — HTTP concerns only  
✅ **Dependency direction** — delivery → application → domain  

---

## Next Steps (Optional)

Recommended enhancements:
1. **Rate Limiting** — Limit login attempts
2. **Audit Logging** — Log all auth events
3. **Email Verification** — Verify email on signup
4. **Password Reset** — Forgot password flow
5. **2FA** — Two-factor authentication
6. **Session Management** — View/revoke all sessions
7. **Password Policy** — Enforce complexity rules

---

**Status:** Production-ready ✅  
**Database:** PostgreSQL @ localhost:5432/datn  
**Server:** http://localhost:3000  
**Language:** Vietnamese error messages ✅

