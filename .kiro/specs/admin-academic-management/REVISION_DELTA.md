# Revision Delta Summary: Admin Academic Management

## Business Clarification Applied

**Date**: 2025-01-XX  
**Reason**: Major business clarification on academic hierarchy

---

## Critical Schema Changes

### 1. **Major.departmentId → Major.facultyId**

**Before (INCORRECT)**:
```prisma
model Major {
  departmentId String
  department   Department @relation(fields: [departmentId], references: [id])
}
```

**After (CORRECTED)**:
```prisma
model Major {
  facultyId String
  faculty   Faculty @relation(fields: [facultyId], references: [id])
}
```

**Impact**: Major now belongs to Faculty, not Department. Department and Major are siblings under Faculty.

---

### 2. **Added Required Fields to Teacher_Profile**

**New Fields**:
- `academicRank: String?` (REQUIRED, nullable for migration compatibility)
- `academicDegree: String?` (REQUIRED, nullable for migration compatibility)

**Impact**: Teacher profiles now capture academic rank and degree information.

---

### 3. **Student_Profile.classId → Student_Profile.academicClassId**

**Before**:
```prisma
model Student_Profile {
  classId String?
  class   AcademicClass? @relation(fields: [classId], references: [id])
}
```

**After**:
```prisma
model Student_Profile {
  academicClassId String? @map("classId")
  academicClass   AcademicClass? @relation(fields: [academicClassId], references: [id])
}
```

**Impact**: Naming consistency throughout codebase; uses `@map("classId")` for backward compatibility with existing column.

---

### 4. **Faculty Relations Updated**

**Before**:
```prisma
model Faculty {
  departments Department[]
}
```

**After**:
```prisma
model Faculty {
  departments Department[]
  majors      Major[]      // NEW: Major belongs to Faculty
}
```

**Impact**: Faculty can now have both Departments and Majors as direct children.

---

### 5. **Department Relations Updated**

**Before**:
```prisma
model Department {
  majors   Major[]
  teachers Teacher_Profile[]
}
```

**After**:
```prisma
model Department {
  teachers Teacher_Profile[]  // Majors removed - they belong to Faculty
}
```

**Impact**: Department no longer has Majors as children; only has Teachers.

---

## Requirements.md Changes

### Hierarchy Description Updates

**Section**: Introduction / Glossary

**Before**:
- Academic_Structure: The hierarchy `Faculty -> Department -> Major -> AcademicClass`

**After**:
- Academic_Structure: The hierarchy where Faculty is the top level, Department and Major are siblings under Faculty (Department for teachers, Major for students), and AcademicClass belongs to Major

---

### Requirement 1: Manage Academic Structure Entities

**Changes**:
1. Added hierarchy rules explanation at the beginning
2. Updated AC 3: "WHEN an admin creates a Major, THE Admin_API SHALL validate that the parent **Faculty** exists" (was Department)
3. Updated AC 6: "WHEN an admin lists Majors with `facultyId`" (was departmentId)
4. Updated AC 8: "WHEN an admin deletes a Faculty that still has child Departments **or child Majors**" (added Majors)
5. Updated AC 9: "WHEN an admin deletes a Department that still has linked Teacher_Profiles" (removed "child Majors")

---

### Requirement 3: Manage Teacher Profiles Independently

**Changes**:
1. Updated AC 2: Added required fields - "SHALL require `teacherCode`, `fullName`, `departmentId`, **`academicRank`, and `academicDegree`** fields"

---

### Requirement 4: Manage Student Profiles Independently

**Changes**:
1. Updated AC 2: "SHALL require `studentCode`, `fullName`, and **`academicClassId`** fields" (was classId)
2. Updated AC 7: "SHALL support filtering by `facultyId`, `majorId`, **`academicClassId`**" (removed departmentId, changed classId to academicClassId)
3. Updated AC 8: "SHALL include linked Account information if present and the related Faculty/**Major**/AcademicClass context" (removed Department)

---

### Requirement 8: Support Hierarchical Filtering and Hierarchy Context

**Major Rewrite**:
- Added hierarchy rules explanation
- Updated AC 2: "Majors by `facultyId`" (was "Majors whose parent Department belongs to that Faculty")
- Updated AC 3: "AcademicClasses by `majorId`" (was departmentId)
- Updated AC 6: "Student_Profiles by `facultyId`, `majorId`, or `academicClassId`" (removed departmentId, changed classId)
- Updated AC 9: Added "Majors SHALL provide corresponding Faculty context"
- Updated AC 10: "AcademicClasses SHALL provide corresponding Major and Faculty context" (removed Department)

---

### Requirement 9: Support Search and Filtering for All Entity Types

**Changes**:
1. Updated AC 10: "Student_Profiles SHALL support `facultyId`, `majorId`, **`academicClassId`**" (removed departmentId, changed classId to academicClassId)

---

## Design.md Changes

### Feature Scope

**Added**:
- Explicit hierarchy explanation: "Faculty (top level), Department (belongs to Faculty) - for organizing teachers, Major (belongs to Faculty) - for organizing students, AcademicClass (belongs to Major)"

**Design Principles**:
- Added principle 7: "Corrected Hierarchy: Department and Major are siblings under Faculty (not parent-child)"

---

### Module Organization

**Major Restructuring**:

**Before**: Single `academic-structure/` subdirectory

**After**: Split into entity-specific subdirectories:
- `domain/Faculty/`, `domain/Department/`, `domain/Major/`, `domain/AcademicClass/`
- `application/Faculty/`, `application/Department/`, `application/Major/`, `application/AcademicClass/`
- `delivery/http/Faculty/`, `delivery/http/Department/`, `delivery/http/Major/`, `delivery/http/AcademicClass/`

**Domain Ports Split**:
- Before: Single `domain/Ports.ts`
- After: Separate files - `FacultyPorts.ts`, `DepartmentPorts.ts`, `MajorPorts.ts`, `AcademicClassPorts.ts`, `AccountManagementPorts.ts`, `TeacherManagementPorts.ts`, `StudentManagementPorts.ts`

**Password Hashing**:
- Changed from `PasswordHasherBcrypt.ts` to `PasswordHasherAdapter.ts` (use local admin adapter or shared adapter, not direct coupling to auth/infra)

---

### Domain Ports

**FacultyRepo**:
- Added `hasChildMajors(id: string): Promise<boolean>` method

**DepartmentRepo**:
- Removed `hasChildMajors(id: string)` method (Majors no longer belong to Department)

---

### Domain Types

**Major Type**:
```typescript
// Before
export type Major = {
  departmentId: string;
  department?: Department;
};

// After
export type Major = {
  facultyId: string;  // CORRECTED
  faculty?: Faculty;
};
```

**TeacherProfile Type**:
```typescript
// Before
export type TeacherProfile = {
  teacherCode: string | null;
  fullName: string | null;
  departmentId: string | null;
  phone: string | null;
};

// After
export type TeacherProfile = {
  teacherCode: string;           // REQUIRED
  fullName: string;              // REQUIRED
  departmentId: string;          // REQUIRED
  academicRank: string;          // NEW REQUIRED FIELD
  academicDegree: string;        // NEW REQUIRED FIELD
  phone: string | null;
};
```

**StudentProfile Type**:
```typescript
// Before
export type StudentProfile = {
  classId: string | null;
};

// After
export type StudentProfile = {
  academicClassId: string;       // REQUIRED, renamed from classId
};
```

**StudentProfileWithContext Type**:
```typescript
// Before
export type StudentProfileWithContext = StudentProfile & {
  class?: AcademicClass;
  major?: Major;
  department?: Department;  // REMOVED
  faculty?: Faculty;
};

// After
export type StudentProfileWithContext = StudentProfile & {
  academicClass?: AcademicClass;  // Renamed from class
  major?: Major;
  faculty?: Faculty;              // Department removed
};
```

**TeacherImportRow Type**:
```typescript
// Added fields
academicRank: string;
academicDegree: string;
```

---

### Domain Policies

**Restructured**:
- Before: Single `HierarchyPolicy` class
- After: Separate policy classes per entity:
  - `FacultyPolicy` (checks both Departments and Majors)
  - `DepartmentPolicy` (checks only Teachers, not Majors)
  - `MajorPolicy` (checks Classes)
  - `AcademicClassPolicy` (checks Students)

---

### Prisma Schema Changes

**Critical Design Decisions Section**:
- Added point 1: "Corrected Academic Hierarchy" with full explanation
- Added point 3: "Required Fields" specification
- Updated point 5: "Hierarchy deletion behavior" to include Faculty checking both Departments and Majors

**Schema Models**:
- Faculty: Added `majors Major[]` relation
- Department: Removed `majors Major[]` relation
- Major: Changed `departmentId` to `facultyId`, changed `department` to `faculty`
- Teacher_Profile: Added `academicRank String?` and `academicDegree String?`
- Student_Profile: Changed `classId` to `academicClassId` with `@map("classId")`

---

### Key Schema Decisions

**Added**:
1. "Corrected Hierarchy" section explaining Faculty → Department/Major sibling relationship
2. "Required Fields" section listing mandatory fields (nullable for migration compatibility)
3. "Naming Consistency" section explaining academicClassId usage

**Updated Cascade Behavior**:
- Faculty deletion → RESTRICT if Departments **or Majors** linked
- Department deletion → RESTRICT if Teacher_Profiles linked (removed "or Majors")
- Major deletion → RESTRICT if AcademicClasses linked

---

### Filtering Strategy

**Complete Rewrite**:
- Simplified Department filtering (direct facultyId check)
- Simplified Major filtering (direct facultyId check)
- Updated AcademicClass filtering (through Major.facultyId)
- Updated Teacher filtering (through Department.facultyId)
- Updated Student filtering (removed Department level, uses Major.facultyId)
- Changed all `classId` references to `academicClassId`

---

### Phased Implementation Plan

**Phase 1**:
- Updated deliverables to mention "corrected: Major belongs to Faculty, not Department"

**Phase 2**:
- Added tasks 3-4 for new required fields and academicClassId naming
- Updated task 7 to mention "with required fields"
- Updated deliverables to mention "Required fields are enforced"

**Phase 7**:
- **REMOVED ENTIRELY** from initial implementation scope
- Added note: "Phase 7 (cleanup and migration finalization) is deferred to a later implementation phase"

---

### Error Handling

**Updated**:
- `HAS_CHILD_MAJORS`: Changed message from "Không thể xóa bộ môn còn có ngành" to "Không thể xóa khoa còn có ngành" (Faculty, not Department)

---

### Summary Section

**Complete Rewrite**:
- Added 11 key points (was 6)
- Point 1: Corrected Academic Hierarchy
- Point 3: Required Fields
- Point 4: Naming Consistency
- Point 5: Domain Ports Split
- Point 6: AcademicStructure Split
- Point 11: Six-phase plan (not seven)

---

## Migration Impact

### Database Migration Required

**Breaking Changes**:
1. `Major.departmentId` → `Major.facultyId` (foreign key change)
2. `Teacher_Profile` adds `academicRank` and `academicDegree` columns
3. `Student_Profile.classId` → `Student_Profile.academicClassId` (logical rename, physical column stays `classId` via `@map`)

**Data Migration Script Needed**:
- Migrate existing Major records to point to Faculty instead of Department
- Populate `academicRank` and `academicDegree` with default/null values for existing Teacher_Profile records

---

### API Contract Impact

**Breaking Changes**:
1. Major creation/update endpoints: `departmentId` → `facultyId`
2. Major list/filter endpoints: `departmentId` filter → `facultyId` filter
3. Teacher creation/update endpoints: Add required `academicRank` and `academicDegree` fields
4. Student endpoints: `classId` → `academicClassId` throughout
5. Hierarchical filtering: Department-based Major/Student filtering removed

**Backward Compatibility**:
- Student_Profile uses `@map("classId")` to maintain physical column name
- All other changes are breaking and require frontend updates

---

### Repository Impact

**Affected Repositories**:
1. `MajorRepoPrisma`: Update all queries to use `facultyId` instead of `departmentId`
2. `FacultyRepoPrisma`: Add `hasChildMajors()` method
3. `DepartmentRepoPrisma`: Remove `hasChildMajors()` method
4. `TeacherProfileRepoPrisma`: Handle new required fields in create/update
5. `StudentProfileRepoPrisma`: Use `academicClassId` consistently

---

### Use Case Impact

**Affected Use Cases**:
1. `CreateMajorUseCase`: Validate `facultyId` instead of `departmentId`
2. `UpdateMajorUseCase`: Handle `facultyId` changes
3. `ListMajorsUseCase`: Filter by `facultyId` instead of `departmentId`
4. `DeleteFacultyUseCase`: Check both Departments and Majors
5. `DeleteDepartmentUseCase`: Remove Major check, keep Teacher check
6. `CreateTeacherProfileUseCase`: Require `academicRank` and `academicDegree`
7. `UpdateTeacherProfileUseCase`: Handle new fields
8. All Student use cases: Use `academicClassId` instead of `classId`

---

### DTO Impact

**Affected DTOs**:
1. `CreateMajorDto`: `departmentId` → `facultyId`
2. `UpdateMajorDto`: `departmentId` → `facultyId`
3. `MajorResponseDto`: Include `faculty` instead of `department`
4. `CreateTeacherDto`: Add `academicRank` and `academicDegree` (required)
5. `UpdateTeacherDto`: Add `academicRank` and `academicDegree` (optional)
6. `TeacherResponseDto`: Include new fields
7. All Student DTOs: `classId` → `academicClassId`

---

## Rollback Strategy

**If Rollback Needed**:
1. Revert Prisma schema changes
2. Run down migration to restore `Major.departmentId`
3. Remove `Teacher_Profile.academicRank` and `Teacher_Profile.academicDegree` columns
4. Revert all code changes (repositories, use cases, DTOs, routes)
5. Restore previous API contracts

**Data Preservation**:
- Major-to-Faculty relationships can be reconstructed from Department-to-Faculty relationships
- New Teacher fields can be dropped without data loss (nullable)
- Student `academicClassId` is just a logical rename (physical column unchanged)

---

## Testing Impact

**New Test Cases Required**:
1. Faculty deletion with Majors (should reject)
2. Department deletion without Majors (should succeed if no Teachers)
3. Major creation with facultyId validation
4. Major filtering by facultyId
5. Teacher creation with required academicRank and academicDegree
6. Student operations using academicClassId
7. Hierarchical filtering with corrected hierarchy

**Updated Test Cases**:
1. All Major-related tests (change departmentId to facultyId)
2. All Teacher-related tests (add required fields)
3. All Student-related tests (change classId to academicClassId)
4. Hierarchical filtering tests (remove Department-based Major/Student filtering)

---

## Documentation Impact

**Updated Documentation**:
1. API documentation: Update all Major, Teacher, Student endpoints
2. Database schema documentation: Update ERD diagrams
3. Architecture documentation: Update hierarchy diagrams
4. Migration guide: Document breaking changes and migration steps

---

## Summary of Changes

### Requirements.md
- **Lines Changed**: ~50 lines across 5 requirements
- **Breaking Changes**: Hierarchy model, required fields, naming consistency
- **Additions**: Hierarchy rules, academicRank, academicDegree, academicClassId

### Design.md
- **Lines Changed**: ~200 lines across 10 sections
- **Breaking Changes**: Schema, ports, types, policies, filtering, implementation plan
- **Additions**: Entity-specific organization, required fields, corrected hierarchy
- **Removals**: Phase 7 (deferred)

### Critical Path
1. Schema migration (Major.facultyId, Teacher fields, Student naming)
2. Repository updates (all Major/Teacher/Student repos)
3. Use case updates (all affected use cases)
4. DTO updates (all affected DTOs)
5. Route updates (all affected routes)
6. Frontend updates (API contract changes)

---

## Approval Required

**Schema Changes**: ✅ Approved (business clarification)  
**API Breaking Changes**: ⚠️ Requires frontend coordination  
**Implementation Scope**: ✅ Phases 1-6 only (Phase 7 deferred)

---

**End of Delta Summary**
