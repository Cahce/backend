# Technical Design Document: Admin Academic Management

## Overview

This document specifies the technical design for the Admin Academic Management feature, which provides comprehensive administrative capabilities for managing academic structure, user accounts, teacher profiles, and student profiles within the Typst collaborative editing platform backend.

### Feature Scope

The feature enables administrators to:
- Manage academic hierarchy:
  - Faculty (top level)
  - Department (belongs to Faculty) - for organizing teachers
  - Major (belongs to Faculty) - for organizing students
  - AcademicClass (belongs to Major)
- Manage user accounts independently of academic profiles
- Manage teacher and student profiles as independent entities with optional account links
- Link and unlink accounts with profiles bidirectionally
- Import teacher and student data from Excel files
- Search, filter, and paginate across all entity types

### Design Principles

1. **Independent Entity Management**: Accounts, teacher profiles, and student profiles are independent entities that can exist without each other
2. **Nullable Linking**: Teacher_Profile and Student_Profile have nullable accountId fields for optional 1-to-0..1 relationships with Account
3. **Lifecycle Independence**: Deleting an account unlinks and preserves the profile; deleting a profile unlinks and preserves the account
4. **Hierarchical Integrity**: Academic structure relationships enforce referential integrity with REJECT semantics for deletion
5. **Clean Architecture**: Strict layer boundaries with domain-driven design
6. **Vietnamese UX**: All user-facing errors and messages in Vietnamese
7. **Corrected Hierarchy**: Department and Major are siblings under Faculty (not parent-child)

## Architecture

### Module Organization

The feature will be implemented entirely within the existing `admin` module at `src/modules/admin/`, organized into four logical subdomains with improved HTTP delivery structure:

```
src/modules/admin/
├── domain/
│   ├── Faculty/
│   │   ├── Types.ts              # Faculty types
│   │   ├── Policies.ts           # Faculty validation policies
│   │   └── Errors.ts             # Faculty domain errors
│   ├── Department/
│   │   ├── Types.ts              # Department types
│   │   ├── Policies.ts           # Department validation policies
│   │   └── Errors.ts             # Department domain errors
│   ├── Major/
│   │   ├── Types.ts              # Major types
│   │   ├── Policies.ts           # Major validation policies
│   │   └── Errors.ts             # Major domain errors
│   ├── AcademicClass/
│   │   ├── Types.ts              # AcademicClass types
│   │   ├── Policies.ts           # AcademicClass validation policies
│   │   └── Errors.ts             # AcademicClass domain errors
│   ├── AccountManagement/
│   │   ├── Types.ts              # Account types and commands
│   │   ├── Policies.ts           # Account validation and linking policies
│   │   └── Errors.ts             # Account management domain errors
│   ├── TeacherManagement/
│   │   ├── Types.ts              # Teacher profile types
│   │   ├── Policies.ts           # Teacher validation policies
│   │   └── Errors.ts             # Teacher management domain errors
│   ├── StudentManagement/
│   │   ├── Types.ts              # Student profile types
│   │   ├── Policies.ts           # Student validation policies
│   │   └── Errors.ts             # Student management domain errors
│   ├── FacultyPorts.ts           # Faculty repository interface
│   ├── DepartmentPorts.ts        # Department repository interface
│   ├── MajorPorts.ts             # Major repository interface
│   ├── AcademicClassPorts.ts     # AcademicClass repository interface
│   ├── AccountManagementPorts.ts # Account repository interface
│   ├── TeacherManagementPorts.ts # Teacher repository interface
│   └── StudentManagementPorts.ts # Student repository interface
├── application/
│   ├── Faculty/
│   │   ├── CreateFacultyUseCase.ts
│   │   ├── ListFacultiesUseCase.ts
│   │   ├── UpdateFacultyUseCase.ts
│   │   └── DeleteFacultyUseCase.ts
│   ├── Department/
│   │   ├── CreateDepartmentUseCase.ts
│   │   ├── ListDepartmentsUseCase.ts
│   │   ├── UpdateDepartmentUseCase.ts
│   │   └── DeleteDepartmentUseCase.ts
│   ├── Major/
│   │   ├── CreateMajorUseCase.ts
│   │   ├── ListMajorsUseCase.ts
│   │   ├── UpdateMajorUseCase.ts
│   │   └── DeleteMajorUseCase.ts
│   ├── AcademicClass/
│   │   ├── CreateAcademicClassUseCase.ts
│   │   ├── ListAcademicClassesUseCase.ts
│   │   ├── UpdateAcademicClassUseCase.ts
│   │   └── DeleteAcademicClassUseCase.ts
│   ├── AccountManagement/
│   │   ├── CreateAccountUseCase.ts
│   │   ├── ListAccountsUseCase.ts
│   │   ├── GetAccountDetailsUseCase.ts
│   │   ├── UpdateAccountUseCase.ts
│   │   ├── DeactivateAccountUseCase.ts
│   │   ├── DeleteAccountUseCase.ts
│   │   ├── LinkAccountToTeacherUseCase.ts
│   │   ├── LinkAccountToStudentUseCase.ts
│   │   ├── UnlinkAccountFromProfileUseCase.ts
│   │   └── CreateAccountWithProfileUseCase.ts
│   ├── TeacherManagement/
│   │   ├── CreateTeacherProfileUseCase.ts
│   │   ├── ListTeacherProfilesUseCase.ts
│   │   ├── GetTeacherProfileDetailsUseCase.ts
│   │   ├── UpdateTeacherProfileUseCase.ts
│   │   ├── DeleteTeacherProfileUseCase.ts
│   │   ├── CreateTeacherWithAccountUseCase.ts
│   │   └── ImportTeachersFromExcelUseCase.ts
│   ├── StudentManagement/
│   │   ├── CreateStudentProfileUseCase.ts
│   │   ├── ListStudentProfilesUseCase.ts
│   │   ├── GetStudentProfileDetailsUseCase.ts
│   │   ├── UpdateStudentProfileUseCase.ts
│   │   ├── DeleteStudentProfileUseCase.ts
│   │   ├── CreateStudentWithAccountUseCase.ts
│   │   └── ImportStudentsFromExcelUseCase.ts
│   └── Types.ts                  # Shared application types (Result, PaginatedResult)
├── infra/
│   ├── FacultyRepoPrisma.ts
│   ├── DepartmentRepoPrisma.ts
│   ├── MajorRepoPrisma.ts
│   ├── AcademicClassRepoPrisma.ts
│   ├── AdminAccountRepoPrisma.ts
│   ├── TeacherProfileRepoPrisma.ts
│   ├── StudentProfileRepoPrisma.ts
│   ├── ExcelParserXlsx.ts
│   └── PasswordHasherAdapter.ts  # Local admin adapter or shared adapter
├── delivery/
│   └── http/
│       ├── Faculty/
│       │   ├── Dto.ts            # Faculty DTOs
│       │   └── Routes.ts         # Faculty routes
│       ├── Department/
│       │   ├── Dto.ts            # Department DTOs
│       │   └── Routes.ts         # Department routes
│       ├── Major/
│       │   ├── Dto.ts            # Major DTOs
│       │   └── Routes.ts         # Major routes
│       ├── AcademicClass/
│       │   ├── Dto.ts            # AcademicClass DTOs
│       │   └── Routes.ts         # AcademicClass routes
│       ├── AccountManagement/
│       │   ├── Dto.ts            # Account DTOs
│       │   └── Routes.ts         # Account routes
│       ├── TeacherManagement/
│       │   ├── Dto.ts            # Teacher profile DTOs
│       │   └── Routes.ts         # Teacher routes
│       └── StudentManagement/
│           ├── Dto.ts            # Student profile DTOs
│           └── Routes.ts         # Student routes
└── Container.ts                  # Dependency injection wiring
```

### Layer Responsibilities

#### Domain Layer
- **No framework dependencies**: Pure TypeScript types, interfaces, and business rules
- **Defines ports**: Repository and service interfaces that infra will implement
- **Business policies**: Validation rules, linking constraints, hierarchy rules
- **Domain errors**: Vietnamese error messages for business rule violations
- **Critical**: Teacher_Profile and Student_Profile are modeled as independent entities with nullable accountId links

#### Application Layer
- **Use case orchestration**: Coordinates domain logic and repository calls
- **Transaction boundaries**: Manages atomic operations (e.g., create account + link profile)
- **Result types**: Returns typed success/failure results, never throws to delivery
- **No framework imports**: No Fastify, Prisma, or Zod
- **Linking logic**: Handles bidirectional account-profile linking with proper unlinking on deletion

#### Infrastructure Layer
- **Repository implementations**: Prisma-based data access
- **External adapters**: Excel parsing (xlsx), password hashing (bcrypt)
- **Query optimization**: Includes for hierarchy context, indexes for filters
- **Transaction support**: Prisma transactions for atomic operations
- **Deletion handling**: Implements unlink-and-preserve semantics for account/profile deletion

#### Delivery Layer
- **HTTP routing**: Fastify route registration with auth guards
- **Request validation**: Zod schemas with OpenAPI annotations
- **Response mapping**: Maps application results to HTTP responses
- **Error translation**: Converts domain errors to appropriate HTTP status codes
- **Subdomain organization**: Separate Dto.ts and Routes.ts per subdomain for maintainability

## Components and Interfaces

### Domain Ports

```typescript
// src/modules/admin/domain/FacultyPorts.ts

export interface FacultyRepo {
  create(data: CreateFacultyData): Promise<Faculty>;
  findById(id: string): Promise<Faculty | null>;
  findAll(filters: FacultyFilters): Promise<PaginatedResult<Faculty>>;
  update(id: string, data: UpdateFacultyData): Promise<Faculty>;
  delete(id: string): Promise<void>;
  hasChildDepartments(id: string): Promise<boolean>;
  hasChildMajors(id: string): Promise<boolean>;
}

// src/modules/admin/domain/DepartmentPorts.ts

export interface DepartmentRepo {
  create(data: CreateDepartmentData): Promise<Department>;
  findById(id: string): Promise<Department | null>;
  findAll(filters: DepartmentFilters): Promise<PaginatedResult<Department>>;
  update(id: string, data: UpdateDepartmentData): Promise<Department>;
  delete(id: string): Promise<void>;
  hasLinkedTeachers(id: string): Promise<boolean>;
}

// src/modules/admin/domain/MajorPorts.ts

export interface MajorRepo {
  create(data: CreateMajorData): Promise<Major>;
  findById(id: string): Promise<Major | null>;
  findAll(filters: MajorFilters): Promise<PaginatedResult<Major>>;
  update(id: string, data: UpdateMajorData): Promise<Major>;
  delete(id: string): Promise<void>;
  hasChildClasses(id: string): Promise<boolean>;
}

// src/modules/admin/domain/AcademicClassPorts.ts

export interface AcademicClassRepo {
  create(data: CreateAcademicClassData): Promise<AcademicClass>;
  findById(id: string): Promise<AcademicClass | null>;
  findAll(filters: AcademicClassFilters): Promise<PaginatedResult<AcademicClass>>;
  update(id: string, data: UpdateAcademicClassData): Promise<AcademicClass>;
  delete(id: string): Promise<void>;
  hasLinkedStudents(id: string): Promise<boolean>;
}

// src/modules/admin/domain/AccountManagementPorts.ts

export interface AdminAccountRepo {
  create(data: CreateAccountData): Promise<Account>;
  findById(id: string): Promise<Account | null>;
  findByEmail(email: string): Promise<Account | null>;
  findAll(filters: AccountFilters): Promise<PaginatedResult<AccountWithProfile>>;
  update(id: string, data: UpdateAccountData): Promise<Account>;
  delete(id: string): Promise<void>; // Must unlink profile before deleting
  linkToTeacher(accountId: string, teacherId: string): Promise<void>;
  linkToStudent(accountId: string, studentId: string): Promise<void>;
  unlinkFromProfile(accountId: string): Promise<void>;
}

// src/modules/admin/domain/TeacherManagementPorts.ts

export interface TeacherProfileRepo {
  create(data: CreateTeacherData): Promise<TeacherProfile>;
  findById(id: string): Promise<TeacherProfile | null>;
  findByTeacherCode(code: string): Promise<TeacherProfile | null>;
  findAll(filters: TeacherFilters): Promise<PaginatedResult<TeacherProfileWithContext>>;
  update(id: string, data: UpdateTeacherData): Promise<TeacherProfile>;
  delete(id: string): Promise<void>; // Must unlink account before deleting
  bulkUpsert(teachers: TeacherImportRow[], mode: ImportMode): Promise<ImportResult>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
}

// src/modules/admin/domain/StudentManagementPorts.ts

export interface StudentProfileRepo {
  create(data: CreateStudentData): Promise<StudentProfile>;
  findById(id: string): Promise<StudentProfile | null>;
  findByStudentCode(code: string): Promise<StudentProfile | null>;
  findAll(filters: StudentFilters): Promise<PaginatedResult<StudentProfileWithContext>>;
  update(id: string, data: UpdateStudentData): Promise<StudentProfile>;
  delete(id: string): Promise<void>; // Must unlink account before deleting
  bulkUpsert(students: StudentImportRow[], mode: ImportMode): Promise<ImportResult>;
}

export interface ExcelParser {
  parseTeacherFile(buffer: Buffer): Promise<TeacherImportRow[]>;
  parseStudentFile(buffer: Buffer): Promise<StudentImportRow[]>;
}
```

### Domain Types

```typescript
// Academic Structure Types
export type Faculty = {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Department = {
  id: string;
  name: string;
  code: string;
  facultyId: string;  // Department belongs to Faculty
  faculty?: Faculty;
  createdAt: Date;
  updatedAt: Date;
};

export type Major = {
  id: string;
  name: string;
  code: string;
  facultyId: string;  // CORRECTED: Major belongs to Faculty, not Department
  faculty?: Faculty;
  createdAt: Date;
  updatedAt: Date;
};

export type AcademicClass = {
  id: string;
  name: string;
  code: string;
  majorId: string;
  major?: Major;
  createdAt: Date;
  updatedAt: Date;
};

// Account Types
export type Account = {
  id: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AccountWithProfile = Account & {
  teacherProfile?: TeacherProfile;
  studentProfile?: StudentProfile;
};

// Teacher Profile Types (CORRECTED: independent entity with nullable accountId)
export type TeacherProfile = {
  id: string;                    // Own primary key
  accountId: string | null;      // Nullable link to Account
  teacherCode: string;           // REQUIRED (nullable only for migration compatibility)
  fullName: string;              // REQUIRED (nullable only for migration compatibility)
  departmentId: string;          // REQUIRED (nullable only for migration compatibility)
  academicRank: string;          // REQUIRED (NEW FIELD)
  academicDegree: string;        // REQUIRED (NEW FIELD)
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TeacherProfileWithContext = TeacherProfile & {
  account?: Account;
  department?: Department;
  faculty?: Faculty;
};

// Student Profile Types (CORRECTED: independent entity with nullable accountId)
export type StudentProfile = {
  id: string;                    // Own primary key
  accountId: string | null;      // Nullable link to Account
  studentCode: string;           // REQUIRED (nullable only for migration compatibility)
  fullName: string;              // REQUIRED (nullable only for migration compatibility)
  academicClassId: string;       // REQUIRED (nullable only for migration compatibility) - CORRECTED: use academicClassId not classId
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StudentProfileWithContext = StudentProfile & {
  account?: Account;
  academicClass?: AcademicClass;  // CORRECTED: use academicClass not class
  major?: Major;
  faculty?: Faculty;              // CORRECTED: removed department (not in student hierarchy)
};

// Import Types
export type ImportMode = 'skip-existing' | 'update-existing';

export type TeacherImportRow = {
  teacherCode: string;
  fullName: string;
  departmentCode: string;
  academicRank: string;           // NEW FIELD
  academicDegree: string;         // NEW FIELD
  phone?: string;
  email?: string;
  createAccount?: boolean;
};

export type StudentImportRow = {
  studentCode: string;
  fullName: string;
  classCode: string;
  phone?: string;
  email?: string;
  createAccount?: boolean;
};

export type ImportResult = {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: RowError[];
};

export type RowError = {
  row: number;
  code: string;
  message: string;
  field?: string;
};
```

### Domain Policies

```typescript
// src/modules/admin/domain/AccountManagement/Policies.ts

export class AccountLinkingPolicy {
  static canLinkToTeacher(account: Account, teacher: TeacherProfile): Result<void> {
    if (account.role !== 'teacher') {
      return failure('ROLE_MISMATCH', 'Tài khoản phải có vai trò giáo viên');
    }
    if (teacher.accountId && teacher.accountId !== account.id) {
      return failure('TEACHER_ALREADY_LINKED', 'Hồ sơ giáo viên đã được liên kết với tài khoản khác');
    }
    return success(undefined);
  }

  static canLinkToStudent(account: Account, student: StudentProfile): Result<void> {
    if (account.role !== 'student') {
      return failure('ROLE_MISMATCH', 'Tài khoản phải có vai trò sinh viên');
    }
    if (student.accountId && student.accountId !== account.id) {
      return failure('STUDENT_ALREADY_LINKED', 'Hồ sơ sinh viên đã được liên kết với tài khoản khác');
    }
    return success(undefined);
  }

  static canChangeRole(account: AccountWithProfile, newRole: string): Result<void> {
    if (account.teacherProfile && newRole !== 'teacher') {
      return failure('TEACHER_LINK_EXISTS', 'Không thể đổi vai trò khi còn liên kết với hồ sơ giáo viên');
    }
    if (account.studentProfile && newRole !== 'student') {
      return failure('STUDENT_LINK_EXISTS', 'Không thể đổi vai trò khi còn liên kết với hồ sơ sinh viên');
    }
    return success(undefined);
  }
}

// src/modules/admin/domain/Faculty/Policies.ts

export class FacultyPolicy {
  static canDeleteFaculty(hasDepartments: boolean, hasMajors: boolean): Result<void> {
    if (hasDepartments) {
      return failure('HAS_CHILD_DEPARTMENTS', 'Không thể xóa khoa còn có bộ môn');
    }
    if (hasMajors) {
      return failure('HAS_CHILD_MAJORS', 'Không thể xóa khoa còn có ngành');
    }
    return success(undefined);
  }
}

// src/modules/admin/domain/Department/Policies.ts

export class DepartmentPolicy {
  static canDeleteDepartment(hasTeachers: boolean): Result<void> {
    if (hasTeachers) {
      return failure('HAS_LINKED_TEACHERS', 'Không thể xóa bộ môn còn có giáo viên');
    }
    return success(undefined);
  }
}

// src/modules/admin/domain/Major/Policies.ts

export class MajorPolicy {
  static canDeleteMajor(hasClasses: boolean): Result<void> {
    if (hasClasses) {
      return failure('HAS_CHILD_CLASSES', 'Không thể xóa ngành còn có lớp');
    }
    return success(undefined);
  }
}

// src/modules/admin/domain/AcademicClass/Policies.ts

export class AcademicClassPolicy {
  static canDeleteClass(hasStudents: boolean): Result<void> {
    if (hasStudents) {
      return failure('HAS_LINKED_STUDENTS', 'Không thể xóa lớp còn có sinh viên');
    }
    return success(undefined);
  }
}
```

## Data Models

### Prisma Schema Changes

The feature requires new models for the academic structure hierarchy and modifications to existing Teacher and Student models to make them independent entities with nullable account links.

**CRITICAL DESIGN DECISIONS:**

1. **Corrected Academic Hierarchy**:
   - Faculty is the top level
   - Department and Major are SIBLINGS under Faculty (NOT parent-child)
   - Department belongs to Faculty (used for organizing teachers)
   - Major belongs to Faculty (used for organizing students)
   - AcademicClass belongs to Major

2. **Teacher_Profile and Student_Profile are independent entities**:
   - They have their own primary key (`id`)
   - They have a nullable `accountId` field for optional 1-to-0..1 relationship with User/Account
   - They are NOT dependent on User via `userId @id`

3. **Required Fields** (nullable fields are for migration compatibility only):
   - Teacher_Profile: `teacherCode`, `fullName`, `departmentId`, `academicRank`, `academicDegree` are REQUIRED
   - Student_Profile: `studentCode`, `fullName`, `academicClassId` are REQUIRED
   - Use `academicClassId` consistently (not `classId`)

4. **Account/Profile lifecycle independence**:
   - Deleting an Account must unlink and preserve the Teacher_Profile or Student_Profile
   - Deleting a Teacher_Profile or Student_Profile must unlink and preserve the Account
   - NO cascade deletion across account/profile boundaries

5. **Hierarchy deletion behavior**:
   - Deleting Faculty with child Departments or Majors must be REJECTED (Restrict)
   - Deleting Department with linked Teacher_Profiles must be REJECTED (Restrict)
   - Deleting Major with child AcademicClasses must be REJECTED (Restrict)
   - Deleting AcademicClass with linked Student_Profiles must be REJECTED (Restrict)
   - NOT SET NULL - the requirements explicitly state rejection

```prisma
// New models to add to prisma/schema.prisma

model Faculty {
  id          String       @id @default(cuid())
  name        String
  code        String       @unique
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  departments Department[]
  majors      Major[]      // CORRECTED: Major belongs to Faculty

  @@index([code])
}

model Department {
  id         String    @id @default(cuid())
  name       String
  code       String    @unique
  facultyId  String
  faculty    Faculty   @relation(fields: [facultyId], references: [id], onDelete: Restrict)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  teachers   Teacher_Profile[]

  @@index([facultyId])
  @@index([code])
}

model Major {
  id           String          @id @default(cuid())
  name         String
  code         String          @unique
  facultyId    String          // CORRECTED: Major belongs to Faculty, not Department
  faculty      Faculty         @relation(fields: [facultyId], references: [id], onDelete: Restrict)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
  classes      AcademicClass[]

  @@index([facultyId])
  @@index([code])
}

model AcademicClass {
  id        String    @id @default(cuid())
  name      String
  code      String    @unique
  majorId   String
  major     Major     @relation(fields: [majorId], references: [id], onDelete: Restrict)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  students  Student_Profile[]

  @@index([majorId])
  @@index([code])
}

// CORRECTED: Teacher_Profile as independent entity with required fields
model Teacher_Profile {
  id             String      @id @default(cuid())  // Own primary key
  accountId      String?     @unique               // Nullable link to User
  account        User?       @relation(fields: [accountId], references: [id], onDelete: SetNull)
  teacherCode    String?     @unique               // REQUIRED (nullable for migration compatibility)
  fullName       String?                           // REQUIRED (nullable for migration compatibility)
  departmentId   String?                           // REQUIRED (nullable for migration compatibility)
  department     Department? @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  academicRank   String?                           // REQUIRED (NEW FIELD, nullable for migration compatibility)
  academicDegree String?                           // REQUIRED (NEW FIELD, nullable for migration compatibility)
  phone          String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  advising       ProjectAdvisor[]

  @@index([accountId])
  @@index([departmentId])
  @@index([teacherCode])
}

// CORRECTED: Student_Profile as independent entity with required fields and academicClassId
model Student_Profile {
  id              String         @id @default(cuid())  // Own primary key
  accountId       String?        @unique               // Nullable link to User
  account         User?          @relation(fields: [accountId], references: [id], onDelete: SetNull)
  studentCode     String?        @unique               // REQUIRED (nullable for migration compatibility)
  fullName        String?                             // REQUIRED (nullable for migration compatibility)
  academicClassId String?        @map("classId")      // REQUIRED (nullable for migration compatibility) - CORRECTED: use academicClassId
  academicClass   AcademicClass? @relation(fields: [academicClassId], references: [id], onDelete: Restrict)
  phone           String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([accountId])
  @@index([academicClassId])
  @@index([studentCode])
}

// Modifications to existing User model
model User {
  id                  String           @id @default(cuid())
  email               String           @unique
  role                UserRole
  passwordHash        String?
  isActive            Boolean          @default(true)
  mustChangePassword  Boolean          @default(false)
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt
  
  // CORRECTED: 1-to-0..1 relationships (opposite side)
  teacherProfile      Teacher_Profile?
  studentProfile      Student_Profile?
  
  // ... other existing relations
  ownedProjects       Project[]        @relation("ProjectOwner")
  requestedCompileJobs CompileJob[]    @relation("CompileJobRequestedBy")
  memberships         ProjectMember[]
  createdShareLinks   ProjectShareLink[]
  identities          UserIdentity[]
  quota               UserQuota?
  invalidTokens       InvalidToken[]
  zoteroConnections   ZoteroConnection[]
}

// Update ProjectAdvisor to reference Teacher_Profile by id, not userId
model ProjectAdvisor {
  id        String          @id @default(cuid())
  projectId String
  teacherId String
  project   Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  teacher   Teacher_Profile @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  isPrimary Boolean         @default(false)
  createdAt DateTime        @default(now())

  @@unique([projectId, teacherId])
  @@index([teacherId])
  @@index([projectId])
}
```

### Schema Migration Strategy

1. **Phase 1**: Add new academic structure models (Faculty, Department, Major, AcademicClass) with corrected hierarchy
2. **Phase 2**: Create new Teacher_Profile and Student_Profile models as independent entities with required fields
3. **Phase 3**: Data migration script to copy existing Teacher/Student data to new models
4. **Phase 4**: Update ProjectAdvisor foreign key to reference Teacher_Profile.id
5. **Phase 5**: Drop old Teacher and Student models
6. **Phase 6**: Rename Teacher_Profile → Teacher, Student_Profile → Student (optional cleanup - NOT in first implementation)

**Note**: Phase 6 (cleanup/rename) is deferred to a later phase and NOT part of the initial implementation (phases 1-5 only).

### Key Schema Decisions

1. **Corrected Hierarchy**:
   - Faculty is the top level
   - Department and Major are siblings under Faculty (both have `facultyId`)
   - Department is for organizing teachers
   - Major is for organizing students
   - AcademicClass belongs to Major

2. **Cascade Behavior**:
   - User deletion → SET NULL on Teacher_Profile.accountId and Student_Profile.accountId (preserve profiles)
   - Teacher_Profile deletion → no cascade to User (preserve account)
   - Student_Profile deletion → no cascade to User (preserve account)
   - Academic structure deletion → RESTRICT (prevent orphaned data, reject deletion)
   - Faculty deletion → RESTRICT if Departments or Majors linked (reject)
   - Department deletion → RESTRICT if Teacher_Profiles linked (reject, not SET NULL)
   - Major deletion → RESTRICT if AcademicClasses linked (reject)
   - AcademicClass deletion → RESTRICT if Student_Profiles linked (reject, not SET NULL)

3. **Unique Constraints**:
   - `Faculty.code`, `Department.code`, `Major.code`, `AcademicClass.code` are unique
   - `Teacher_Profile.teacherCode`, `Student_Profile.studentCode` are unique and nullable
   - `Teacher_Profile.accountId`, `Student_Profile.accountId` are unique and nullable (1-to-0..1)

4. **Indexes**:
   - Foreign keys for hierarchy traversal
   - Code fields for lookup during import
   - accountId fields for join queries
   - Composite indexes for common filter patterns

5. **Linking Model**:
   - Teacher_Profile and Student_Profile are the "owning" side of the relationship
   - They hold the nullable accountId foreign key
   - User has optional reverse relations (teacherProfile?, studentProfile?)
   - This enables independent lifecycle management

6. **Required Fields** (nullable for migration compatibility only):
   - Teacher_Profile: `teacherCode`, `fullName`, `departmentId`, `academicRank`, `academicDegree`
   - Student_Profile: `studentCode`, `fullName`, `academicClassId`

7. **Naming Consistency**:
   - Use `academicClassId` and `academicClass` (not `classId`/`class`)
   - Student_Profile uses `@map("classId")` for backward compatibility with existing column

## Linking and Unlinking Flows

### Account-to-Profile Linking

**Link Account to Teacher_Profile:**
1. Validate account role is 'teacher'
2. Check Teacher_Profile.accountId is null or matches account.id
3. Check account is not already linked to a Student_Profile
4. Update Teacher_Profile.accountId = account.id
5. Transaction ensures atomicity

**Link Account to Student_Profile:**
1. Validate account role is 'student'
2. Check Student_Profile.accountId is null or matches account.id
3. Check account is not already linked to a Teacher_Profile
4. Update Student_Profile.accountId = account.id
5. Transaction ensures atomicity

### Profile-to-Account Linking

**Create Teacher_Profile with Account:**
1. Create Teacher_Profile with accountId = null
2. If account creation requested:
   - Create Account with role='teacher', initial password='123456', mustChangePassword=true
   - Update Teacher_Profile.accountId = newAccount.id
3. Transaction ensures atomicity

**Create Student_Profile with Account:**
1. Create Student_Profile with accountId = null
2. If account creation requested:
   - Create Account with role='student', initial password='123456', mustChangePassword=true
   - Update Student_Profile.accountId = newAccount.id
3. Transaction ensures atomicity

### Unlinking Flows

**Unlink Account from Profile:**
1. Find profile by accountId
2. Set profile.accountId = null
3. Account remains unchanged

**Delete Account:**
1. Find linked Teacher_Profile or Student_Profile by accountId
2. Set profile.accountId = null (unlink)
3. Delete Account
4. Profile is preserved
5. Transaction ensures atomicity

**Delete Teacher_Profile:**
1. Find linked Account by Teacher_Profile.accountId
2. Set Teacher_Profile.accountId = null (unlink)
3. Delete Teacher_Profile
4. Account is preserved
5. Transaction ensures atomicity

**Delete Student_Profile:**
1. Find linked Account by Student_Profile.accountId
2. Set Student_Profile.accountId = null (unlink)
3. Delete Student_Profile
4. Account is preserved
5. Transaction ensures atomicity

## Filtering Strategy

### Hierarchical Filtering

The system supports filtering entities by their position in the academic hierarchy:

**CORRECTED HIERARCHY:**
- Faculty (top level)
- Department and Major are siblings under Faculty
- AcademicClass belongs to Major

**Filter Departments by Faculty:**
```typescript
WHERE facultyId = ?
```

**Filter Majors by Faculty:**
```typescript
WHERE facultyId = ?
```

**Filter AcademicClasses by Faculty:**
```typescript
WHERE majorId IN (SELECT id FROM Major WHERE facultyId = ?)
```

**Filter AcademicClasses by Major:**
```typescript
WHERE majorId = ?
```

**Filter Teacher_Profiles by Faculty:**
```typescript
WHERE departmentId IN (SELECT id FROM Department WHERE facultyId = ?)
```

**Filter Teacher_Profiles by Department:**
```typescript
WHERE departmentId = ?
```

**Filter Student_Profiles by Faculty:**
```typescript
WHERE academicClassId IN (
  SELECT id FROM AcademicClass WHERE majorId IN (
    SELECT id FROM Major WHERE facultyId = ?
  )
)
```

**Filter Student_Profiles by Major:**
```typescript
WHERE academicClassId IN (SELECT id FROM AcademicClass WHERE majorId = ?)
```

**Filter Student_Profiles by AcademicClass:**
```typescript
WHERE academicClassId = ?
```

### Link State Filtering

**Filter Accounts by Link State:**
- Linked accounts: `WHERE teacherProfile IS NOT NULL OR studentProfile IS NOT NULL`
- Unlinked accounts: `WHERE teacherProfile IS NULL AND studentProfile IS NULL`

**Filter Teacher_Profiles by Link State:**
- Linked: `WHERE accountId IS NOT NULL`
- Unlinked: `WHERE accountId IS NULL`

**Filter Student_Profiles by Link State:**
- Linked: `WHERE accountId IS NOT NULL`
- Unlinked: `WHERE accountId IS NULL`

### Search Strategy

**Code Search (Exact Match Only):**
- Teacher_Profile: `WHERE teacherCode = ?` (exact match)
- Student_Profile: `WHERE studentCode = ?` (exact match)

**Name Search (Case-Insensitive Partial Match):**
- Faculty/Department/Major/Class: `WHERE LOWER(name) LIKE LOWER('%' || ? || '%')`
- Teacher_Profile/Student_Profile: `WHERE LOWER(fullName) LIKE LOWER('%' || ? || '%')`

**Email Search (Case-Insensitive Partial Match):**
- Account: `WHERE LOWER(email) LIKE LOWER('%' || ? || '%')`

### Combined Filters

When multiple filters are provided, they are combined with AND logic:
```typescript
WHERE condition1 AND condition2 AND condition3
```

## Phased Implementation Plan

### Phase 1: Academic Structure Foundation
**Goal**: Establish the academic hierarchy and basic CRUD operations

**Tasks**:
1. Create Prisma models for Faculty, Department, Major, AcademicClass
2. Run migration to add new tables
3. Implement domain types and policies for academic structure
4. Implement repositories (FacultyRepoPrisma, DepartmentRepoPrisma, MajorRepoPrisma, AcademicClassRepoPrisma)
5. Implement use cases for CRUD operations on all four entities
6. Implement delivery layer (DTOs and Routes) for academic structure
7. Test hierarchy validation and deletion rules

**Deliverables**:
- Academic structure entities can be created, read, updated, deleted
- Hierarchy constraints are enforced (corrected: Major belongs to Faculty, not Department)
- Deletion rules prevent orphaned data

### Phase 2: Independent Profile Entities
**Goal**: Create Teacher_Profile and Student_Profile as independent entities with required fields

**Tasks**:
1. Create new Prisma models for Teacher_Profile and Student_Profile with own primary keys
2. Add nullable accountId fields for optional account links
3. Add required fields: `academicRank` and `academicDegree` for Teacher_Profile
4. Use `academicClassId` consistently for Student_Profile (with `@map("classId")` for compatibility)
5. Run migration to create new tables
6. Implement data migration script to copy existing Teacher/Student data
7. Update domain types to reflect independent entity model with required fields
8. Implement repositories (TeacherProfileRepoPrisma, StudentProfileRepoPrisma)
9. Implement use cases for profile CRUD operations
10. Implement delivery layer for profile management
11. Test profile creation without accounts

**Deliverables**:
- Teacher_Profile and Student_Profile can exist independently
- Required fields are enforced (nullable for migration compatibility)
- Old Teacher/Student models are deprecated but still present
- Data is migrated to new models

### Phase 3: Account Management
**Goal**: Implement account CRUD and deactivation

**Tasks**:
1. Implement domain types and policies for account management
2. Implement AdminAccountRepoPrisma
3. Implement account use cases (Create, List, Get, Update, Deactivate, Delete)
4. Implement delivery layer for account management
5. Implement password hashing adapter
6. Test account lifecycle operations

**Deliverables**:
- Accounts can be created, listed, updated, deactivated, deleted
- Account deletion preserves profiles (unlink-and-preserve)

### Phase 4: Bidirectional Linking
**Goal**: Enable linking and unlinking between accounts and profiles

**Tasks**:
1. Implement linking policies in domain layer
2. Implement linking use cases (LinkAccountToTeacher, LinkAccountToStudent, Unlink)
3. Implement atomic create-and-link use cases
4. Update delete use cases to unlink before deletion
5. Implement delivery layer for linking operations
6. Test all linking scenarios and edge cases

**Deliverables**:
- Accounts and profiles can be linked bidirectionally
- Unlinking preserves both entities
- Deletion unlinks and preserves the other entity
- Role-based linking rules are enforced

### Phase 5: Filtering and Search
**Goal**: Implement comprehensive filtering and search capabilities

**Tasks**:
1. Implement hierarchical filtering in repositories
2. Implement link state filtering
3. Implement search by name, code, email
4. Implement pagination for all list endpoints
5. Add indexes for common filter patterns
6. Test filter combinations and performance

**Deliverables**:
- All entities support pagination
- Hierarchical filtering works correctly
- Search and filter combinations work as expected

### Phase 6: Excel Import
**Goal**: Enable bulk import of teacher and student data

**Tasks**:
1. Implement ExcelParserXlsx adapter
2. Implement import use cases (ImportTeachersFromExcel, ImportStudentsFromExcel)
3. Implement dryRun mode for validation
4. Implement skip-existing and update-existing modes
5. Implement account creation during import
6. Implement row-level error reporting
7. Implement delivery layer for import endpoints
8. Test import scenarios and error handling

**Deliverables**:
- Teachers and students can be imported from Excel
- Import modes work correctly
- Accounts can be created during import
- Row-level errors are reported in Vietnamese

**Note**: Phase 7 (cleanup and migration finalization) is deferred to a later implementation phase and NOT included in the initial scope (phases 1-6 only).

## Error Handling

### Domain Error Categories

**Academic Structure Errors:**
- `HAS_CHILD_DEPARTMENTS`: "Không thể xóa khoa còn có bộ môn"
- `HAS_CHILD_MAJORS`: "Không thể xóa khoa còn có ngành"  // CORRECTED: Faculty can have Majors
- `HAS_CHILD_CLASSES`: "Không thể xóa ngành còn có lớp"
- `HAS_LINKED_TEACHERS`: "Không thể xóa bộ môn còn có giáo viên"
- `HAS_LINKED_STUDENTS`: "Không thể xóa lớp còn có sinh viên"
- `PARENT_NOT_FOUND`: "Không tìm thấy đơn vị cha"
- `DUPLICATE_CODE`: "Mã đã tồn tại"

**Account Management Errors:**
- `EMAIL_ALREADY_EXISTS`: "Email đã được sử dụng"
- `INVALID_EMAIL_DOMAIN`: "Email không thuộc miền cho phép"
- `ACCOUNT_NOT_FOUND`: "Không tìm thấy tài khoản"
- `ACCOUNT_INACTIVE`: "Tài khoản đã bị vô hiệu hóa"

**Linking Errors:**
- `ROLE_MISMATCH`: "Vai trò tài khoản không khớp với loại hồ sơ"
- `TEACHER_ALREADY_LINKED`: "Hồ sơ giáo viên đã được liên kết với tài khoản khác"
- `STUDENT_ALREADY_LINKED`: "Hồ sơ sinh viên đã được liên kết với tài khoản khác"
- `ACCOUNT_ALREADY_LINKED`: "Tài khoản đã được liên kết với hồ sơ khác"
- `TEACHER_LINK_EXISTS`: "Không thể đổi vai trò khi còn liên kết với hồ sơ giáo viên"
- `STUDENT_LINK_EXISTS`: "Không thể đổi vai trò khi còn liên kết với hồ sơ sinh viên"

**Profile Errors:**
- `TEACHER_CODE_ALREADY_EXISTS`: "Mã giáo viên đã tồn tại"
- `STUDENT_CODE_ALREADY_EXISTS`: "Mã sinh viên đã tồn tại"
- `TEACHER_NOT_FOUND`: "Không tìm thấy hồ sơ giáo viên"
- `STUDENT_NOT_FOUND`: "Không tìm thấy hồ sơ sinh viên"
- `DEPARTMENT_NOT_FOUND`: "Không tìm thấy bộ môn"
- `CLASS_NOT_FOUND`: "Không tìm thấy lớp"

**Import Errors:**
- `INVALID_FILE_FORMAT`: "Định dạng file không hợp lệ"
- `MISSING_REQUIRED_COLUMN`: "Thiếu cột bắt buộc"
- `INVALID_ROW_DATA`: "Dữ liệu dòng không hợp lệ"
- `DEPARTMENT_CODE_NOT_FOUND`: "Không tìm thấy mã bộ môn"
- `CLASS_CODE_NOT_FOUND`: "Không tìm thấy mã lớp"
- `DUPLICATE_EMAIL_IN_IMPORT`: "Email trùng lặp trong file import"

### HTTP Error Mapping

| Domain Error Code | HTTP Status | Response Format |
|---|---|---|
| NOT_FOUND errors | 404 | `{ error: { code, message } }` |
| ALREADY_EXISTS errors | 409 | `{ error: { code, message } }` |
| VALIDATION errors | 400 | `{ error: { code, message, field? } }` |
| BUSINESS_RULE errors | 422 | `{ error: { code, message } }` |
| IMPORT errors | 400 | `{ error: { code, message, rows? } }` |

### Error Response Examples

**Single Error:**
```json
{
  "error": {
    "code": "HAS_CHILD_DEPARTMENTS",
    "message": "Không thể xóa khoa còn có bộ môn"
  }
}
```

**Validation Error with Field:**
```json
{
  "error": {
    "code": "INVALID_EMAIL_DOMAIN",
    "message": "Email không thuộc miền cho phép",
    "field": "email"
  }
}
```

**Import Error with Row Details:**
```json
{
  "totalRows": 100,
  "created": 85,
  "updated": 0,
  "skipped": 10,
  "failed": 5,
  "errors": [
    {
      "row": 12,
      "code": "DEPARTMENT_CODE_NOT_FOUND",
      "message": "Không tìm thấy mã bộ môn",
      "field": "departmentCode"
    },
    {
      "row": 45,
      "code": "DUPLICATE_EMAIL_IN_IMPORT",
      "message": "Email trùng lặp trong file import",
      "field": "email"
    }
  ]
}
```

## Testing Strategy

### Unit Testing

**Domain Layer Tests:**
- Policy validation logic (AccountLinkingPolicy, HierarchyPolicy)
- Domain error creation and messages
- Type guards and validation functions

**Application Layer Tests:**
- Use case orchestration logic
- Transaction boundary handling
- Result type mapping
- Error propagation

**Infrastructure Layer Tests:**
- Repository query logic
- Filter and search implementation
- Pagination logic
- Excel parsing logic

**Test Coverage Goals:**
- Domain policies: 100%
- Use cases: 90%+
- Repositories: 80%+

### Integration Testing

**Database Integration:**
- Prisma repository implementations against test database
- Transaction rollback behavior
- Cascade and restrict behavior
- Index performance

**API Integration:**
- End-to-end HTTP request/response flows
- Authentication and authorization
- Error response formatting
- Pagination behavior

**Import Integration:**
- Excel file parsing
- Bulk upsert operations
- Row-level error handling
- Transaction atomicity

### Property-Based Testing

This feature is **NOT suitable for property-based testing** because:
1. It is primarily CRUD operations with database side effects
2. Most operations involve external dependencies (database, file system)
3. Business rules are specific rather than universal properties
4. Testing requires specific test data setup and teardown

**Alternative Testing Approach:**
- Use example-based unit tests for business logic
- Use integration tests with test database for repository operations
- Use snapshot tests for DTO validation schemas
- Use manual/automated API tests for end-to-end flows

### Test Data Strategy

**Test Fixtures:**
- Sample academic hierarchy (1 Faculty → 2 Departments → 3 Majors → 5 Classes)
- Sample accounts (admin, teacher, student roles)
- Sample profiles (linked and unlinked)
- Sample Excel files (valid and invalid formats)

**Test Database:**
- Use separate test database
- Reset between test suites
- Seed with minimal fixture data
- Clean up after tests

### Manual Testing Checklist

**Academic Structure:**
- [ ] Create Faculty/Department/Major/Class
- [ ] Update entities
- [ ] Delete with children (should reject)
- [ ] Delete without children (should succeed)
- [ ] Filter by hierarchy
- [ ] Search by name

**Account Management:**
- [ ] Create account with each role
- [ ] List accounts with filters
- [ ] Update account details
- [ ] Deactivate account
- [ ] Delete account (should unlink profile)
- [ ] Change role (should validate links)

**Profile Management:**
- [ ] Create teacher/student profile without account
- [ ] Create profile with account
- [ ] Update profile
- [ ] Delete profile (should unlink account)
- [ ] Filter by hierarchy
- [ ] Filter by link state

**Linking:**
- [ ] Link account to teacher profile
- [ ] Link account to student profile
- [ ] Attempt invalid links (should reject)
- [ ] Unlink account from profile
- [ ] Delete account (should preserve profile)
- [ ] Delete profile (should preserve account)

**Import:**
- [ ] Import teachers from valid Excel
- [ ] Import students from valid Excel
- [ ] Import with skip-existing mode
- [ ] Import with update-existing mode
- [ ] Import with account creation
- [ ] Import with invalid data (should report errors)
- [ ] DryRun mode (should not persist)



## Correctness Properties

This feature is **NOT suitable for property-based testing** because:

1. **CRUD Operations with Side Effects**: The feature primarily consists of create, read, update, and delete operations that interact with a database. These operations have side effects and require specific test data setup and teardown.

2. **External Dependencies**: Most operations depend on external systems (PostgreSQL database, file system for Excel imports) rather than being pure functions.

3. **Specific Business Rules**: The business rules are specific constraints (e.g., "cannot delete Department with linked Teachers") rather than universal properties that hold across all inputs.

4. **State-Dependent Behavior**: Operations depend on existing database state (e.g., checking if a Department has children before deletion), making it difficult to generate arbitrary valid inputs.

**Testing Approach:**
- Use **example-based unit tests** for domain policies and business logic
- Use **integration tests** with a test database for repository operations
- Use **snapshot tests** for DTO validation schemas
- Use **manual/automated API tests** for end-to-end workflows

The Testing Strategy section above provides comprehensive coverage for validating this feature's correctness without property-based testing.

---

## Summary

This design document provides a complete technical specification for the Admin Academic Management feature with the following key corrections:

1. **Corrected Academic Hierarchy**: Major belongs to Faculty (NOT Department); Department and Major are siblings under Faculty
2. **Independent Entity Model**: Teacher_Profile and Student_Profile are independent entities with their own primary keys and nullable accountId links
3. **Required Fields**: Teacher_Profile requires teacherCode, fullName, departmentId, academicRank, academicDegree; Student_Profile requires studentCode, fullName, academicClassId
4. **Naming Consistency**: Use academicClassId and academicClass (not classId/class) throughout
5. **Domain Ports Split**: Separate port files for Faculty, Department, Major, AcademicClass, AccountManagement, TeacherManagement, StudentManagement
6. **AcademicStructure Split**: Domain, application, and delivery layers organized by entity (Faculty, Department, Major, AcademicClass) not as single "AcademicStructure"
7. **Lifecycle Independence**: Account deletion unlinks and preserves profiles; profile deletion unlinks and preserves accounts
8. **Rejection-Based Deletion**: Faculty/Department/Major/Class deletion is rejected when children or linked profiles exist
9. **Improved HTTP Structure**: Delivery layer organized into entity-specific subdirectories with Dto.ts and Routes.ts files
10. **Comprehensive Flows**: Detailed linking/unlinking, filtering, and import workflows
11. **Phased Implementation**: Six-phase plan for incremental delivery (phases 1-6 only; phase 7 cleanup deferred)

The design is consistent with the approved requirements and follows Clean Architecture principles throughout.