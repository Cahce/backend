# Phase 1 Pre-Migration Check Report

**Date**: April 18, 2026  
**Status**: ✅ SAFE TO PROCEED

## 1.1 SSO-only Accounts Check

**Query**: `SELECT id, email FROM "User" WHERE "passwordHash" IS NULL`

**Result**: ✅ No SSO-only accounts found

All users have passwords set. Safe to make `passwordHash` required.

## 1.2 Codebase Symbol References

### UserIdentity References

**Location**: Only in generated Prisma files (`src/generated/prisma/**`, `dist/**`)

**Source Code**: ❌ No references found in `src/**/*.ts` (excluding generated)

**Conclusion**: Safe to remove UserIdentity model

### IdentityProvider References

**Location**: Only in generated Prisma files

**Source Code**: ❌ No references found in `src/**/*.ts` (excluding generated)

**Note**: References to "ldap" and "google" are only in:
- Generated Prisma enum definitions
- SQL commenter documentation comments (unrelated to auth)

**Conclusion**: Safe to remove IdentityProvider enum

### Legacy Profile References

**Searched for**: `teacherLegacy`, `studentLegacy`, `Teacher_Legacy`, `Student_Legacy`

**Result**: ❌ No references found in source code

**Conclusion**: Safe to remove legacy models and User relations

### Nullable passwordHash Checks

**Found**: 1 occurrence in `src/modules/auth/application/LoginUseCase.ts:44`

```typescript
if (!user.passwordHash) {
    // SSO-only account, cannot login with password
    throw new InvalidCredentialsError();
}
```

**Action Required**: Remove this check after making passwordHash required

**Other occurrences**: Only in generated Prisma type definitions (expected)

## Summary

| Check | Status | Action Required |
|-------|--------|-----------------|
| SSO-only accounts | ✅ None found | None |
| UserIdentity references | ✅ Only in generated | None |
| IdentityProvider references | ✅ Only in generated | None |
| Legacy profile references | ✅ None found | None |
| passwordHash null checks | ⚠️ 1 found | Remove after schema change |

## Files Requiring Code Changes

1. **src/modules/auth/application/LoginUseCase.ts** (line 44-48)
   - Remove the `if (!user.passwordHash)` check
   - Remove the SSO-only account comment

## Recommendation

✅ **PROCEED TO PHASE 2**

All pre-migration checks passed. Only one code change required after schema migration.
