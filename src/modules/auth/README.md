# Auth Module

Authentication module for the Typst platform backend.

## Features

- ✅ Email/password login
- ✅ JWT token generation with revocation support
- ✅ Get current user information
- ✅ Logout with token invalidation
- ✅ Change password
- ✅ Vietnamese error messages
- ✅ School domain validation (@tlu.edu.vn, @e.tlu.edu.vn)

## Architecture

This module follows clean architecture principles:

```
auth/
├── domain/           # Business rules, no framework dependencies
│   ├── AuthErrors.ts      # Domain error types (Vietnamese)
│   ├── EmailPolicy.ts     # Email validation rules
│   └── Ports.ts           # Repository/service interfaces
├── application/      # Use cases, orchestration
│   ├── LoginUseCase.ts
│   ├── GetCurrentUserUseCase.ts
│   ├── LogoutUseCase.ts
│   ├── ChangePasswordUseCase.ts
│   └── Types.ts
├── infra/           # Technology implementations
│   ├── UserRepoPrisma.ts
│   ├── PasswordHasherBcrypt.ts
│   ├── JwtTokenServiceFastify.ts
│   └── TokenRevocationRepoPrisma.ts
└── delivery/        # HTTP layer
    └── http/
        ├── Dto.ts        # Request/response schemas
        └── Routes.ts     # Route registration
```

## API Endpoints

### Public Endpoints

#### POST /api/v1/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "admin@tlu.edu.vn",
  "password": "123456"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "admin@tlu.edu.vn",
    "role": "admin"
  }
}
```

### Protected Endpoints

All protected endpoints require `Authorization: Bearer <token>` header.

#### GET /api/v1/auth/me
Get current user information.

**Response:**
```json
{
  "user": {
    "id": "...",
    "email": "admin@tlu.edu.vn",
    "role": "admin"
  }
}
```

#### POST /api/v1/auth/logout
Logout and revoke current token.

**Response:**
```json
{
  "message": "Đăng xuất thành công"
}
```

#### POST /api/v1/auth/change-password
Change user password.

**Request:**
```json
{
  "oldPassword": "123456",
  "newPassword": "newpass123",
  "confirmNewPassword": "newpass123"
}
```

**Response:**
```json
{
  "message": "Đổi mật khẩu thành công"
}
```

## Business Rules

### Email Validation
- Must be valid email format
- Must use school domains:
  - Students: `@e.tlu.edu.vn`
  - Teachers/Admin: `@tlu.edu.vn`

### Password Rules
- Stored as bcrypt hash (10 rounds)
- Never shown in plain text
- Change password requires:
  - Correct old password
  - New password different from old
  - Confirmation must match new password

### Token Rules
- JWT with jti (JWT ID) for revocation
- Tokens can be revoked on logout
- Revoked tokens cannot be reused
- Token verification checks revocation list

## Error Messages

All error messages are in Vietnamese:

| Code | Message |
|------|---------|
| `INVALID_EMAIL_FORMAT` | Định dạng email không hợp lệ |
| `UNSUPPORTED_EMAIL_DOMAIN` | Tên miền email không được hỗ trợ... |
| `INVALID_CREDENTIALS` | Email hoặc mật khẩu không đúng |
| `ACCOUNT_INACTIVE` | Tài khoản đã bị vô hiệu hóa |
| `UNAUTHORIZED` | Chưa xác thực |
| `OLD_PASSWORD_INCORRECT` | Mật khẩu cũ không đúng |
| `PASSWORDS_DO_NOT_MATCH` | Mật khẩu xác nhận không khớp |
| `NEW_PASSWORD_SAME_AS_OLD` | Mật khẩu mới phải khác mật khẩu cũ |

## Testing

```bash
# Seed test users
npm run seed:users

# Test all auth endpoints
npm run test:api:auth

# Test login only
npm run test:api:login
```

## Security

- ✅ Password hashing with bcrypt
- ✅ User enumeration prevention
- ✅ Token revocation support
- ✅ Email normalization
- ✅ Domain validation
- ✅ Account status checks

## Dependencies

- `bcryptjs` — Password hashing
- `@fastify/jwt` — JWT token generation
- `zod` — Request validation
- `@prisma/client` — Database access

## Out of Scope

- SSO integration (LDAP, Google)
- Refresh token flow
- Password reset via email
- 2FA
- Rate limiting

These features may be added in future iterations.
