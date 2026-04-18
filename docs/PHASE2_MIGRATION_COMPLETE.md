# Phase 2 Migration Complete

## Summary

Phase 2 schema migration has been successfully completed. The Teacher and Student models have been transformed into independent entities with nullable `accountId` fields for optional account linking.

## What Was Done

### 1. Schema Changes Applied

**Migration**: `20260417081531_add_teacher_student_profiles`

**Teacher Model Changes**:
- Changed primary key from `userId` to `id` (own primary key)
- Added `accountId` field (nullable, unique) for optional account linking
- Added `departmentId` field (required) with foreign key to Department
- Added `academicRank` field (required)
- Added `academicDegree` field (required)
- Removed `department` string field (replaced with departmentId foreign key)
- Made `teacherCode` and `fullName` required (NOT NULL)

**Student Model Changes**:
- Changed primary key from `userId` to `id` (own primary key)
- Added `accountId` field (nullable, unique) for optional account linking
- Added `classId` field (required) with foreign key to AcademicClass
- Removed `className` and `faculty` string fields (replaced with classId foreign key)
- Made `studentCode` and `fullName` required (NOT NULL)

**Legacy Models Created**:
- `Teacher_Legacy` table created to preserve old schema structure
- `Student_Legacy` table created to preserve old schema structure
- Both tables are empty (no data migration needed since original tables were empty)

**Project Model Changes**:
- Added `category` field (TemplateCategory enum, default 'other')
- Added index on `category` field

**ProjectAdvisor Model Changes**:
- Updated `teacherId` foreign key to reference `Teacher.id` instead of `User.id`
- Updated relation name to `advisorAssignments`

### 2. Build Configuration Updated

**package.json**:
- Added `postbuild` script to copy Prisma client to `dist/generated`
- Updated `build` script to run `postbuild` after TypeScript compilation

### 3. Verification

✅ Prisma migration generated and applied successfully
✅ Prisma client regenerated
✅ TypeScript build passes
✅ Server starts successfully
✅ Smoke tests pass
✅ All tables created with correct structure
✅ All indexes created
✅ All foreign keys created with correct cascade behavior

## Database State

**Current Row Counts**:
- Teacher: 0
- Student: 0
- Teacher_Legacy: 0
- Student_Legacy: 0

**Schema Verification**:
- Teacher table has correct columns: id, accountId, teacherCode, fullName, departmentId, academicRank, academicDegree, phone, createdAt, updatedAt
- Student table has correct columns: id, accountId, studentCode, fullName, classId, phone, createdAt, updatedAt
- Legacy tables have correct structure for rollback safety

## Next Steps

### Phase 2 Implementation Tasks

Now that the schema is ready, the following implementation tasks remain:

1. **Domain Layer**:
   - Create Teacher domain types, policies, errors, and ports
   - Create Student domain types, policies, errors, and ports
   - Create Account linking policies

2. **Application Layer**:
   - Implement Teacher use cases (Create, List, Get, Update, Delete, Import)
   - Implement Student use cases (Create, List, Get, Update, Delete, Import)
   - Implement Account linking use cases (Link/Unlink)

3. **Infrastructure Layer**:
   - Implement TeacherProfileRepoPrisma
   - Implement StudentProfileRepoPrisma
   - Implement ExcelParserXlsx for import functionality

4. **Delivery Layer**:
   - Create Teacher HTTP DTOs and routes
   - Create Student HTTP DTOs and routes
   - Create Account linking HTTP DTOs and routes

5. **Testing**:
   - Write integration tests for Teacher CRUD
   - Write integration tests for Student CRUD
   - Write integration tests for Account linking
   - Write integration tests for Excel import

## Migration Scripts Status

The original migration scripts (`migrate-phase2a-profiles.ts`, `migrate-phase2b-advisors.ts`) are no longer needed because:

1. The tables were empty when the migration ran
2. Prisma's auto-migration handled the schema transformation correctly
3. No data migration was required

These scripts can be kept for reference but are not needed for execution.

## Rollback Strategy

If rollback is needed:

1. The `Teacher_Legacy` and `Student_Legacy` tables preserve the old schema structure
2. A rollback migration can be created to:
   - Drop new Teacher and Student tables
   - Rename Teacher_Legacy → Teacher
   - Rename Student_Legacy → Student
   - Restore old ProjectAdvisor foreign key

## Notes

- All required fields are marked as NOT NULL in the database
- All unique constraints are in place
- All indexes are created for performance
- All foreign keys have correct cascade behavior (SetNull for account deletion, Restrict for hierarchy deletion)
- The schema is ready for Phase 2 implementation

## Date

April 17, 2026
