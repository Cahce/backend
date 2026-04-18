# Phase 2 Domain and Application Layers Complete

## Summary

The domain and application layers for Teacher and Student profile management have been successfully implemented following clean architecture principles.

## What Was Created

### Domain Layer

#### Teacher Management (`src/modules/admin/domain/TeacherManagement/`)
- ✅ **Types.ts**: TeacherProfile, TeacherProfileWithContext, CreateTeacherData, UpdateTeacherData, TeacherFilters, Import types
- ✅ **Errors.ts**: Vietnamese error messages for all teacher-related errors
- ✅ **Policies.ts**: Business rules for teacher validation, deletion, and account linking
- ✅ **Ports.ts**: TeacherProfileRepo interface defining repository contract

#### Student Management (`src/modules/admin/domain/StudentManagement/`)
- ✅ **Types.ts**: StudentProfile, StudentProfileWithContext, CreateStudentData, UpdateStudentData, StudentFilters, Import types
- ✅ **Errors.ts**: Vietnamese error messages for all student-related errors
- ✅ **Policies.ts**: Business rules for student validation and account linking
- ✅ **Ports.ts**: StudentProfileRepo interface defining repository contract

#### Account Management (`src/modules/admin/domain/AccountManagement/`)
- ✅ **Types.ts**: Account, AccountWithProfile types
- ✅ **Errors.ts**: Vietnamese error messages for account linking errors
- ✅ **Policies.ts**: AccountLinkingPolicy for validating account-profile links
- ✅ **Ports.ts**: AdminAccountRepo interface for account queries

### Application Layer

#### Teacher Management Use Cases (`src/modules/admin/application/TeacherManagement/`)
- ✅ **CreateTeacherProfileUseCase.ts**: Create new teacher profile with validation
- ✅ **ListTeacherProfilesUseCase.ts**: List teachers with filters and pagination
- ✅ **GetTeacherProfileDetailsUseCase.ts**: Get teacher details by ID
- ✅ **UpdateTeacherProfileUseCase.ts**: Update teacher profile with validation
- ✅ **DeleteTeacherProfileUseCase.ts**: Delete teacher (checks advisor assignments)
- ✅ **LinkAccountToTeacherUseCase.ts**: Link account to teacher profile
- ✅ **UnlinkAccountFromTeacherUseCase.ts**: Unlink account from teacher profile

#### Student Management Use Cases (`src/modules/admin/application/StudentManagement/`)
- ✅ **CreateStudentProfileUseCase.ts**: Create new student profile with validation
- ✅ **ListStudentProfilesUseCase.ts**: List students with filters and pagination
- ✅ **GetStudentProfileDetailsUseCase.ts**: Get student details by ID
- ✅ **UpdateStudentProfileUseCase.ts**: Update student profile with validation
- ✅ **DeleteStudentProfileUseCase.ts**: Delete student profile
- ✅ **LinkAccountToStudentUseCase.ts**: Link account to student profile
- ✅ **UnlinkAccountFromStudentUseCase.ts**: Unlink account from student profile

## Architecture Compliance

### Clean Architecture Principles ✅
- **Domain layer**: No framework dependencies, pure TypeScript
- **Application layer**: No Prisma, Fastify, or Zod imports
- **Dependency direction**: Application → Domain (correct)
- **Port-based design**: Infrastructure will implement domain ports

### Business Rules Implemented ✅
- Teacher and Student are independent profile entities
- accountId is optional (nullable)
- teacherCode and studentCode must be unique
- departmentId and classId must be validated
- Teacher cannot be deleted if has advisor assignments
- Account linking validates role matching
- Account can only be linked to one profile at a time

### Validation ✅
- Teacher code, full name, academic rank, academic degree validation
- Student code, full name validation
- Duplicate code checking
- Department/Class existence validation
- Account role matching validation

## Next Steps

### 1. Infrastructure Layer
- Implement TeacherProfileRepoPrisma
- Implement StudentProfileRepoPrisma
- Implement AdminAccountRepoPrisma
- Excel parser (deferred until CRUD is stable)

### 2. Delivery Layer
- Create Teacher HTTP DTOs and routes
- Create Student HTTP DTOs and routes
- Create Account linking HTTP DTOs and routes

### 3. Container Wiring
- Wire Teacher use cases with repositories
- Wire Student use cases with repositories
- Register routes in app.ts

### 4. Testing
- Integration tests for Teacher CRUD
- Integration tests for Student CRUD
- Integration tests for account linking
- Search/filter/pagination tests

## File Structure

```
src/modules/admin/
├── domain/
│   ├── TeacherManagement/
│   │   ├── Types.ts
│   │   ├── Errors.ts
│   │   ├── Policies.ts
│   │   └── Ports.ts
│   ├── StudentManagement/
│   │   ├── Types.ts
│   │   ├── Errors.ts
│   │   ├── Policies.ts
│   │   └── Ports.ts
│   └── AccountManagement/
│       ├── Types.ts
│       ├── Errors.ts
│       ├── Policies.ts
│       └── Ports.ts
└── application/
    ├── TeacherManagement/
    │   ├── CreateTeacherProfileUseCase.ts
    │   ├── ListTeacherProfilesUseCase.ts
    │   ├── GetTeacherProfileDetailsUseCase.ts
    │   ├── UpdateTeacherProfileUseCase.ts
    │   ├── DeleteTeacherProfileUseCase.ts
    │   ├── LinkAccountToTeacherUseCase.ts
    │   └── UnlinkAccountFromTeacherUseCase.ts
    └── StudentManagement/
        ├── CreateStudentProfileUseCase.ts
        ├── ListStudentProfilesUseCase.ts
        ├── GetStudentProfileDetailsUseCase.ts
        ├── UpdateStudentProfileUseCase.ts
        ├── DeleteStudentProfileUseCase.ts
        ├── LinkAccountToStudentUseCase.ts
        └── UnlinkAccountFromStudentUseCase.ts
```

## Date

April 17, 2026
