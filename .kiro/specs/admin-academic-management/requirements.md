# Requirements Document: Admin Academic Management

## Introduction

This feature provides administrative capabilities for managing:
- academic structure:
  - Faculty (top level)
  - Department (belongs to Faculty) - for organizing teachers
  - Major (belongs to Faculty) - for organizing students
  - AcademicClass (belongs to Major)
- user accounts
- teacher profiles
- student profiles

The system must allow independent management of each entity type while supporting:
- bidirectional linking between accounts and teacher/student profiles
- hierarchical filtering across academic entities
- Vietnamese user-facing error messages
- pagination for list endpoints
- Excel import for teacher and student data in the first implementation phase

## Glossary

- **Admin_Module**: The existing `admin` module under `src/modules/admin/`
- **Account**: A user account record used for authentication and authorization
- **Teacher_Profile**: A teacher-specific profile record with academic and contact data
- **Student_Profile**: A student-specific profile record with academic and contact data
- **Academic_Structure**: The hierarchy where Faculty is the top level, Department and Major are siblings under Faculty (Department for teachers, Major for students), and AcademicClass belongs to Major
- **Account_Profile_Link**: A nullable 1-1 relationship between an Account and a Teacher_Profile or Student_Profile
- **Hierarchical_Filter**: Filtering that respects the parent-child relationships in the academic structure
- **Excel_Import**: Bulk data import using XLSX files
- **Admin_API**: HTTP REST endpoints under `/api/v1/admin/`

## Functional Requirements

### Requirement 1: Manage Academic Structure Entities

**User Story:** As an admin, I want to create, read, update, and delete Faculty, Department, Major, and AcademicClass records, so that I can maintain the institution's academic hierarchy.

**Hierarchy Rules:**
- Faculty is the top level
- Department belongs to Faculty (used for organizing teachers)
- Major belongs to Faculty (used for organizing students)
- AcademicClass belongs to Major

#### Acceptance Criteria

1. WHEN an admin creates a Faculty, THE Admin_API SHALL persist the Faculty and return the created entity.
2. WHEN an admin creates a Department, THE Admin_API SHALL validate that the parent Faculty exists before persisting the Department.
3. WHEN an admin creates a Major, THE Admin_API SHALL validate that the parent Faculty exists before persisting the Major.
4. WHEN an admin creates an AcademicClass, THE Admin_API SHALL validate that the parent Major exists before persisting the AcademicClass.
5. WHEN an admin lists Departments with `facultyId`, THE Admin_API SHALL return only Departments belonging to that Faculty.
6. WHEN an admin lists Majors with `facultyId`, THE Admin_API SHALL return only Majors belonging to that Faculty.
7. WHEN an admin lists AcademicClasses with `majorId`, THE Admin_API SHALL return only AcademicClasses belonging to that Major.
8. WHEN an admin deletes a Faculty that still has child Departments or child Majors, THE Admin_API SHALL reject the deletion.
9. WHEN an admin deletes a Department that still has linked Teacher_Profiles, THE Admin_API SHALL reject the deletion.
10. WHEN an admin deletes a Major that still has child AcademicClasses, THE Admin_API SHALL reject the deletion.
11. WHEN an admin deletes an AcademicClass that still has linked Student_Profiles, THE Admin_API SHALL reject the deletion.
12. WHEN an admin retrieves or lists academic structure entities, THE Admin_API SHALL provide enough parent hierarchy context for frontend display where relevant.

### Requirement 2: Manage User Accounts Independently

**User Story:** As an admin, I want to create, read, update, deactivate, and delete user accounts independently of teacher and student profiles, so that authentication can be managed separately from academic identity data.

#### Acceptance Criteria

1. WHEN an admin creates an Account, THE Admin_API SHALL validate email format and allowed domain, hash the password, and persist the account.
2. WHEN an admin creates an Account with role `admin`, THE Admin_API SHALL NOT require a linked teacher or student profile.
3. WHEN an admin creates an Account with role `teacher`, THE Admin_API SHALL allow creation without an immediate teacher profile link.
4. WHEN an admin creates an Account with role `student`, THE Admin_API SHALL allow creation without an immediate student profile link.
5. WHEN an admin lists Accounts, THE Admin_API SHALL support pagination, search by email, and filtering by role and active status.
6. WHEN an admin views Account details, THE Admin_API SHALL include linked Teacher_Profile or Student_Profile information if present.
7. WHEN an admin deactivates an Account, THE Admin_API SHALL set `isActive = false` and prevent login for that account.
8. WHEN an admin deletes an Account with a linked Teacher_Profile or Student_Profile, THE Admin_API SHALL remove the link and preserve the remaining profile entity.
9. WHEN an admin filters Accounts by academic hierarchy, THE Admin_API SHALL support filtering by `facultyId`, `departmentId`, `majorId`, and `classId` where applicable through linked profiles.
10. WHEN an admin filters Accounts by link state, THE Admin_API SHALL support distinguishing linked and unlinked accounts.

### Requirement 3: Manage Teacher Profiles Independently

**User Story:** As an admin, I want to create, read, update, and delete teacher profiles independently of user accounts, so that teacher identity data can exist before or without authentication setup.

#### Acceptance Criteria

1. WHEN an admin creates a Teacher_Profile without linking an Account, THE Admin_API SHALL persist the Teacher_Profile with its own identifier and a nullable account link.
2. WHEN an admin creates a Teacher_Profile, THE Admin_API SHALL require `teacherCode`, `fullName`, `departmentId`, `academicRank`, and `academicDegree` fields.
3. WHEN an admin creates a Teacher_Profile, THE Admin_API SHALL enforce uniqueness of `teacherCode`.
4. WHEN an admin creates or updates a Teacher_Profile, THE Admin_API SHALL validate that the selected Department exists.
5. WHEN an admin lists Teacher_Profiles, THE Admin_API SHALL support pagination.
6. WHEN an admin searches Teacher_Profiles, THE Admin_API SHALL support search by `fullName` and exact or structured search by `teacherCode`.
7. WHEN an admin filters Teacher_Profiles, THE Admin_API SHALL support filtering by `facultyId`, `departmentId`, and linked/unlinked account status.
8. WHEN an admin retrieves Teacher_Profile details, THE Admin_API SHALL include linked Account information if present and the related Faculty/Department context.
9. WHEN an admin deletes a Teacher_Profile linked to an Account, THE Admin_API SHALL remove the link and preserve the Account.

### Requirement 4: Manage Student Profiles Independently

**User Story:** As an admin, I want to create, read, update, and delete student profiles independently of user accounts, so that student identity data can exist before or without authentication setup.

#### Acceptance Criteria

1. WHEN an admin creates a Student_Profile without linking an Account, THE Admin_API SHALL persist the Student_Profile with its own identifier and a nullable account link.
2. WHEN an admin creates a Student_Profile, THE Admin_API SHALL require `studentCode`, `fullName`, and `academicClassId` fields.
3. WHEN an admin creates a Student_Profile, THE Admin_API SHALL enforce uniqueness of `studentCode`.
4. WHEN an admin creates or updates a Student_Profile, THE Admin_API SHALL validate that the selected AcademicClass exists.
5. WHEN an admin lists Student_Profiles, THE Admin_API SHALL support pagination.
6. WHEN an admin searches Student_Profiles, THE Admin_API SHALL support search by `fullName` and exact or structured search by `studentCode`.
7. WHEN an admin filters Student_Profiles, THE Admin_API SHALL support filtering by `facultyId`, `majorId`, `academicClassId`, and linked/unlinked account status.
8. WHEN an admin retrieves Student_Profile details, THE Admin_API SHALL include linked Account information if present and the related Faculty/Major/AcademicClass context.
9. WHEN an admin deletes a Student_Profile linked to an Account, THE Admin_API SHALL remove the link and preserve the Account.

### Requirement 5: Link Accounts to Teacher Profiles Bidirectionally

**User Story:** As an admin, I want to link Accounts and Teacher_Profiles in either direction, so that authentication can be added after profile creation or profile data can be created after account creation.

#### Acceptance Criteria

1. WHEN an admin links an existing Account to an existing Teacher_Profile, THE Admin_API SHALL validate that the Account role is `teacher`.
2. WHEN an admin attempts to link an Account with role `student` or `admin` to a Teacher_Profile, THE Admin_API SHALL reject the operation.
3. WHEN an admin attempts to link an Account already linked to another Teacher_Profile, THE Admin_API SHALL reject the operation.
4. WHEN an admin attempts to link a Teacher_Profile already linked to another Account, THE Admin_API SHALL reject the operation.
5. WHEN an admin attempts to link an Account already linked to a Student_Profile, THE Admin_API SHALL reject the operation.
6. WHEN an admin unlinks an Account from a Teacher_Profile, THE Admin_API SHALL preserve both entities and remove only the link.
7. WHEN an admin creates an Account and links it to a Teacher_Profile in one operation, THE Admin_API SHALL perform the operation atomically.
8. WHEN an admin creates a Teacher_Profile and links it to an existing Account in one operation, THE Admin_API SHALL perform the operation atomically.

### Requirement 6: Link Accounts to Student Profiles Bidirectionally

**User Story:** As an admin, I want to link Accounts and Student_Profiles in either direction, so that authentication can be added after profile creation or profile data can be created after account creation.

#### Acceptance Criteria

1. WHEN an admin links an existing Account to an existing Student_Profile, THE Admin_API SHALL validate that the Account role is `student`.
2. WHEN an admin attempts to link an Account with role `teacher` or `admin` to a Student_Profile, THE Admin_API SHALL reject the operation.
3. WHEN an admin attempts to link an Account already linked to another Student_Profile, THE Admin_API SHALL reject the operation.
4. WHEN an admin attempts to link a Student_Profile already linked to another Account, THE Admin_API SHALL reject the operation.
5. WHEN an admin attempts to link an Account already linked to a Teacher_Profile, THE Admin_API SHALL reject the operation.
6. WHEN an admin unlinks an Account from a Student_Profile, THE Admin_API SHALL preserve both entities and remove only the link.
7. WHEN an admin creates an Account and links it to a Student_Profile in one operation, THE Admin_API SHALL perform the operation atomically.
8. WHEN an admin creates a Student_Profile and links it to an existing Account in one operation, THE Admin_API SHALL perform the operation atomically.

### Requirement 7: Enforce Role-Based Linking Rules

**User Story:** As a system administrator, I want strict role-based linking rules, so that account/profile integrity is maintained.

#### Acceptance Criteria

1. WHEN an Account has role `admin`, THE system SHALL allow the Account to exist without a Teacher_Profile or Student_Profile.
2. WHEN an Account has role `teacher`, THE system SHALL allow linking only to a Teacher_Profile.
3. WHEN an Account has role `student`, THE system SHALL allow linking only to a Student_Profile.
4. WHEN an Account is linked to a Teacher_Profile, THE system SHALL prevent linking that same Account to any Student_Profile.
5. WHEN an Account is linked to a Student_Profile, THE system SHALL prevent linking that same Account to any Teacher_Profile.
6. WHEN an admin attempts to change an Account role from `teacher` to `student` while a Teacher_Profile is linked, THE Admin_API SHALL reject the operation until the existing link is removed.
7. WHEN an admin attempts to change an Account role from `student` to `teacher` while a Student_Profile is linked, THE Admin_API SHALL reject the operation until the existing link is removed.

### Requirement 8: Support Hierarchical Filtering and Hierarchy Context

**User Story:** As an admin, I want filters and responses to respect the academic hierarchy, so that I can navigate and display academic relationships correctly.

**Hierarchy Rules:**
- Faculty is the top level
- Department and Major are siblings under Faculty
- Department is used for organizing teachers
- Major is used for organizing students
- AcademicClass belongs to Major

#### Acceptance Criteria

1. WHEN an admin filters Departments by `facultyId`, THE Admin_API SHALL return only Departments in that Faculty.
2. WHEN an admin filters Majors by `facultyId`, THE Admin_API SHALL return only Majors in that Faculty.
3. WHEN an admin filters AcademicClasses by `majorId`, THE Admin_API SHALL return only AcademicClasses in that Major.
4. WHEN an admin filters AcademicClasses by `facultyId`, THE Admin_API SHALL return only AcademicClasses whose parent Major belongs to that Faculty.
5. WHEN an admin filters Teacher_Profiles by `facultyId`, THE Admin_API SHALL return Teacher_Profiles whose Department belongs to that Faculty.
6. WHEN an admin filters Student_Profiles by `facultyId`, `majorId`, or `academicClassId`, THE Admin_API SHALL apply the hierarchy consistently.
7. WHEN an admin filters Accounts by academic hierarchy, THE Admin_API SHALL derive the hierarchy through linked Teacher_Profiles or Student_Profiles.
8. WHEN an admin retrieves Departments, THE Admin_API SHALL provide corresponding Faculty context where relevant.
9. WHEN an admin retrieves Majors, THE Admin_API SHALL provide corresponding Faculty context where relevant.
10. WHEN an admin retrieves AcademicClasses, THE Admin_API SHALL provide corresponding Major and Faculty context where relevant.
11. WHEN an admin retrieves Teacher_Profiles, Student_Profiles, or Accounts, THE Admin_API SHALL provide enough hierarchy context for frontend display and filtering.

### Requirement 9: Support Search and Filtering for All Entity Types

**User Story:** As an admin, I want to search and filter all entities by meaningful attributes, so that I can quickly locate records.

#### Acceptance Criteria

1. WHEN an admin searches Faculties, THE Admin_API SHALL support case-insensitive search by name.
2. WHEN an admin searches Departments, THE Admin_API SHALL support case-insensitive search by name.
3. WHEN an admin searches Majors, THE Admin_API SHALL support case-insensitive search by name.
4. WHEN an admin searches AcademicClasses, THE Admin_API SHALL support search by class name or class code if defined.
5. WHEN an admin searches Teacher_Profiles, THE Admin_API SHALL support search by `fullName` and `teacherCode`.
6. WHEN an admin searches Student_Profiles, THE Admin_API SHALL support search by `fullName` and `studentCode`.
7. WHEN an admin searches Accounts, THE Admin_API SHALL support search by `email`.
8. WHEN an admin filters Accounts, THE Admin_API SHALL support `role`, `isActive`, linked/unlinked state, and academic hierarchy filters.
9. WHEN an admin filters Teacher_Profiles, THE Admin_API SHALL support `facultyId`, `departmentId`, and linked/unlinked state.
10. WHEN an admin filters Student_Profiles, THE Admin_API SHALL support `facultyId`, `majorId`, `academicClassId`, and linked/unlinked state.
11. WHEN an admin combines search and filter parameters, THE Admin_API SHALL apply them using AND logic unless documented otherwise.

### Requirement 10: Import Teacher Data from Excel Files

**User Story:** As an admin, I want to import teacher data from Excel files, so that I can bulk-create or update teacher information efficiently.

#### Acceptance Criteria

1. WHEN an admin uploads a teacher Excel file, THE Admin_API SHALL parse and validate the file structure.
2. WHEN the file structure is invalid, THE Admin_API SHALL reject the import with Vietnamese validation feedback.
3. WHEN teacher rows are valid, THE Admin_API SHALL create or update Teacher_Profiles based on `teacherCode`.
4. WHEN a teacher row refers to academic structure that does not exist, THE Admin_API SHALL report that row as failed.
5. WHEN the import includes account information and the mode allows it, THE Admin_API SHALL create Accounts and link them atomically to Teacher_Profiles.
6. WHEN duplicate email or invalid account linkage occurs in a row, THE Admin_API SHALL record the row as failed and continue processing other rows.
7. WHEN the admin uses `dryRun`, THE Admin_API SHALL validate and report outcomes without persisting changes.
8. WHEN the admin uses `mode=skip-existing`, THE Admin_API SHALL skip existing Teacher_Profiles.
9. WHEN the admin uses `mode=update-existing`, THE Admin_API SHALL update matching Teacher_Profiles.
10. WHEN the import completes, THE Admin_API SHALL return counts for created, updated, skipped, and failed rows, plus row-level error details.

---

### Requirement 11: Import Student Data from Excel Files

**User Story:** As an admin, I want to import student data from Excel files, so that I can bulk-create or update student information efficiently.

#### Acceptance Criteria

1. WHEN an admin uploads a student Excel file, THE Admin_API SHALL parse and validate the file structure.
2. WHEN the file structure is invalid, THE Admin_API SHALL reject the import with Vietnamese validation feedback.
3. WHEN student rows are valid, THE Admin_API SHALL create or update Student_Profiles based on `studentCode`.
4. WHEN a student row refers to AcademicClass or hierarchy data that does not exist, THE Admin_API SHALL report that row as failed.
5. WHEN the import includes account information and the mode allows it, THE Admin_API SHALL create Accounts and link them atomically to Student_Profiles.
6. WHEN duplicate email or invalid account linkage occurs in a row, THE Admin_API SHALL record the row as failed and continue processing other rows.
7. WHEN the admin uses `dryRun`, THE Admin_API SHALL validate and report outcomes without persisting changes.
8. WHEN the admin uses `mode=skip-existing`, THE Admin_API SHALL skip existing Student_Profiles.
9. WHEN the admin uses `mode=update-existing`, THE Admin_API SHALL update matching Student_Profiles.
10. WHEN the import completes, THE Admin_API SHALL return counts for created, updated, skipped, and failed rows, plus row-level error details.

---

### Requirement 12: Account Excel Import Is Optional for Later Phase

**User Story:** As an admin, I may later want to import account data directly from Excel, so that bulk account setup can be supported after the first implementation phase.

#### Acceptance Criteria

1. THE first implementation phase SHALL prioritize teacher and student Excel import before standalone account import.
2. Standalone account import MAY be implemented in a later phase if it fits cleanly into the admin module.
3. IF standalone account import is implemented later, THE Admin_API SHALL validate email uniqueness, hash passwords, and support optional linking to existing Teacher_Profiles or Student_Profiles.

### Requirement 13: Provide Consistent Vietnamese Error Messages

**User Story:** As an admin using a Vietnamese interface, I want validation and business errors in Vietnamese, so that I can understand failures clearly.

#### Acceptance Criteria

1. WHEN an admin operation fails due to validation errors, THE Admin_API SHALL return Vietnamese error messages.
2. WHEN an admin attempts to delete a Faculty with child Departments, THE Admin_API SHALL return a Vietnamese business error.
3. WHEN an admin attempts to link an Account with an incompatible role to a profile, THE Admin_API SHALL return a Vietnamese business error.
4. WHEN an admin attempts to create a duplicate `teacherCode`, THE Admin_API SHALL return a Vietnamese business error.
5. WHEN an admin attempts to create a duplicate `studentCode`, THE Admin_API SHALL return a Vietnamese business error.
6. WHEN an admin attempts to link an Account that is already linked elsewhere, THE Admin_API SHALL return a Vietnamese business error.
7. WHEN an Excel import fails for specific rows, THE Admin_API SHALL return Vietnamese row-level error messages.

---

### Requirement 14: Support Pagination for All List Endpoints

**User Story:** As an admin, I want list endpoints to support pagination, so that I can browse large datasets efficiently.

#### Acceptance Criteria

1. WHEN no pagination parameters are provided, THE Admin_API SHALL return page 1 with a default page size of 20.
2. WHEN `page` and `pageSize` are provided, THE Admin_API SHALL return the requested page.
3. WHEN `pageSize` is greater than 100, THE Admin_API SHALL cap the page size at 100.
4. WHEN the requested page exceeds available results, THE Admin_API SHALL return an empty results array.
5. FOR ALL list endpoints, THE Admin_API SHALL return pagination metadata including total count, current page, page size, and total pages.
6. WHEN pagination parameters are invalid, THE Admin_API SHALL return a validation error.

## Non-Functional and Technical Constraints

1. THE Admin_Module SHALL remain inside the existing `admin` module and SHALL NOT be split into new top-level modules in the first implementation phase.
2. THE Admin_Module SHALL follow clean architecture boundaries:
   - delivery -> application -> domain
   - infra implements ports
   - delivery does not query the database directly
3. THE domain layer SHALL NOT import Fastify, Prisma, or framework code.
4. THE application layer SHALL NOT import Fastify, Prisma, or delivery code.
5. THE infra layer SHALL implement repository and adapter logic.
6. THE module SHALL group functionality into:
   - AcademicStructure
   - AccountManagement
   - TeacherManagement
   - StudentManagement
7. Reusable logic shared only inside admin SHALL stay inside `src/modules/admin/`.
8. Global `src/shared/` SHALL only contain truly generic cross-module logic.
9. The system SHALL use dependency injection or centralized composition for wiring repositories and use cases.
10. Backend source files SHALL use the `.ts` extension and follow the project naming conventions.
