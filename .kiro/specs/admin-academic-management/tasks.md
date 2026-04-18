# Implementation Plan: Admin Academic Management - Phase 1

## Overview

This document outlines the implementation tasks for **Phase 1 ONLY** of the Admin Academic Management feature: **Academic Structure Foundation**.

**Phase 1 Scope**: Establish the academic hierarchy (Faculty, Department, Major, Class) with full CRUD operations, list/search/filter capabilities, deletion rules enforcement, and hierarchy validation.

**Implementation Language**: TypeScript (Fastify + Prisma backend)

**Architecture**: Clean Architecture with strict layer boundaries (delivery → application → domain, infra implements ports)

**Corrected Hierarchy**:
- Faculty (top level)
- Department belongs to Faculty (for organizing teachers)
- Major belongs to Faculty (for organizing students)
- Class belongs to Major

**Out of Scope for Phase 1**:
- Account management
- Teacher/Student profiles
- Account-profile linking
- Excel import
- ProjectAdvisor migration
- Old model cleanup

---

## Tasks

### 1. Schema & Migration

- [x] 1.1 Create Prisma models for academic structure
  - Add Faculty model with id, name, code, timestamps
  - Add Department model with facultyId foreign key
  - Add Major model with facultyId foreign key (CORRECTED: Major belongs to Faculty, not Department)
  - Add Class model with majorId foreign key
  - Add unique constraints on code fields
  - Add indexes for facultyId, majorId, and code fields
  - Set onDelete: Restrict for all foreign keys (reject deletion when children exist)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 1.9, 1.10, 1.11_

- [x] 1.2 Generate and run Prisma migration
  - Run `npx prisma migrate dev --name add_academic_structure`
  - Verify migration creates all tables with correct constraints
  - Verify indexes are created
  - Regenerate Prisma client with `npx prisma generate`
  - Verify build/typecheck compatibility with `npm run build` or `npx tsc --noEmit`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

### 2. Domain Layer - Faculty

- [x] 2.1 Create Faculty domain types
  - Create `src/modules/admin/domain/Faculty/Types.ts`
  - Define Faculty, CreateFacultyData, UpdateFacultyData, FacultyFilters types
  - _Requirements: 1.1_

- [x] 2.2 Create Faculty domain policies
  - Create `src/modules/admin/domain/Faculty/Policies.ts`
  - Implement FacultyPolicy.canDeleteFaculty (check for child Departments and Majors)
  - _Requirements: 1.8_

- [x] 2.3 Create Faculty domain errors
  - Create `src/modules/admin/domain/Faculty/Errors.ts`
  - Define Vietnamese error messages: HAS_CHILD_DEPARTMENTS, HAS_CHILD_MAJORS, DUPLICATE_CODE, FACULTY_NOT_FOUND
  - _Requirements: 13.2_

- [x] 2.4 Create Faculty repository port
  - Create `src/modules/admin/domain/Faculty/Ports.ts`
  - Define FacultyRepo interface with create, findById, findByCode, findAll, update, delete, hasChildDepartments, hasChildMajors methods
  - Add findByCode(code: string) method for duplicate code checking
  - _Requirements: 1.1_

### 3. Domain Layer - Department

- [x] 3.1 Create Department domain types
  - Create `src/modules/admin/domain/Department/Types.ts`
  - Define Department, CreateDepartmentData, UpdateDepartmentData, DepartmentFilters types
  - _Requirements: 1.2_

- [x] 3.2 Create Department domain policies
  - Create `src/modules/admin/domain/Department/Policies.ts`
  - Implement DepartmentPolicy.canDeleteDepartment (check for linked Teachers)
  - _Requirements: 1.9_

- [x] 3.3 Create Department domain errors
  - Create `src/modules/admin/domain/Department/Errors.ts`
  - Define Vietnamese error messages: HAS_LINKED_TEACHERS, DUPLICATE_CODE, DEPARTMENT_NOT_FOUND, FACULTY_NOT_FOUND
  - _Requirements: 13.2_

- [x] 3.4 Create Department repository port
  - Create `src/modules/admin/domain/Department/Ports.ts`
  - Define DepartmentRepo interface with create, findById, findByCode, findAll, update, delete, hasLinkedTeachers methods
  - Add findByCode(code: string) method for duplicate code checking
  - Add hasLinkedTeachers() method (TEMPORARY Phase 1 placeholder - returns false until Phase 2 introduces TeacherProfile)
  - _Requirements: 1.2_

### 4. Domain Layer - Major

- [x] 4.1 Create Major domain types
  - Create `src/modules/admin/domain/Major/Types.ts`
  - Define Major, CreateMajorData, UpdateMajorData, MajorFilters types
  - _Requirements: 1.3_

- [x] 4.2 Create Major domain policies
  - Create `src/modules/admin/domain/Major/Policies.ts`
  - Implement MajorPolicy.canDeleteMajor (check for child Classes)
  - _Requirements: 1.10_

- [x] 4.3 Create Major domain errors
  - Create `src/modules/admin/domain/Major/Errors.ts`
  - Define Vietnamese error messages: HAS_CHILD_CLASSES, DUPLICATE_CODE, MAJOR_NOT_FOUND, FACULTY_NOT_FOUND
  - _Requirements: 13.2_

- [x] 4.4 Create Major repository port
  - Create `src/modules/admin/domain/Major/Ports.ts`
  - Define MajorRepo interface with create, findById, findByCode, findAll, update, delete, hasChildClasses methods
  - Add findByCode(code: string) method for duplicate code checking
  - _Requirements: 1.3_

### 5. Domain Layer - Class

- [x] 5.1 Create Class domain types
  - Create `src/modules/admin/domain/Class/Types.ts`
  - Define Class, CreateClassData, UpdateClassData, ClassFilters types
  - _Requirements: 1.4_

- [x] 5.2 Create Class domain policies
  - Create `src/modules/admin/domain/Class/Policies.ts`
  - Implement ClassPolicy.canDeleteClass (check for linked Students)
  - _Requirements: 1.11_

- [x] 5.3 Create Class domain errors
  - Create `src/modules/admin/domain/Class/Errors.ts`
  - Define Vietnamese error messages: HAS_LINKED_STUDENTS, DUPLICATE_CODE, CLASS_NOT_FOUND, MAJOR_NOT_FOUND
  - _Requirements: 13.2_

- [x] 5.4 Create Class repository port
  - Create `src/modules/admin/domain/Class/Ports.ts`
  - Define ClassRepo interface with create, findById, findByCode, findAll, update, delete, hasLinkedStudents methods
  - Add findByCode(code: string) method for duplicate code checking
  - Add hasLinkedStudents() method (TEMPORARY Phase 1 placeholder - returns false until Phase 2 introduces StudentProfile)
  - _Requirements: 1.4_

### 6. Application Layer - Shared Types

- [x] 6.1 Create shared application types
  - Create `src/modules/admin/application/Types.ts`
  - Define Result<T>, PaginatedResult<T>, PaginationParams types
  - Define success() and failure() helper functions
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

### 7. Application Layer - Faculty Use Cases

- [x] 7.1 Implement CreateFacultyUseCase
  - Create `src/modules/admin/application/Faculty/CreateFacultyUseCase.ts`
  - Validate input data
  - Check for duplicate code
  - Call repository.create()
  - Return Result<Faculty>
  - _Requirements: 1.1_

- [x] 7.2 Implement ListFacultiesUseCase
  - Create `src/modules/admin/application/Faculty/ListFacultiesUseCase.ts`
  - Support pagination (page, pageSize with default 20, max 100)
  - Support search by name (case-insensitive partial match)
  - Call repository.findAll() with filters
  - Return PaginatedResult<Faculty>
  - _Requirements: 1.1, 9.1, 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 7.3 Implement GetFacultyByIdUseCase
  - Create `src/modules/admin/application/Faculty/GetFacultyByIdUseCase.ts`
  - Call repository.findById()
  - Return Result<Faculty>
  - _Requirements: 1.1_

- [x] 7.4 Implement UpdateFacultyUseCase
  - Create `src/modules/admin/application/Faculty/UpdateFacultyUseCase.ts`
  - Validate input data
  - Check for duplicate code (if code is being changed)
  - Call repository.update()
  - Return Result<Faculty>
  - _Requirements: 1.1_

- [x] 7.5 Implement DeleteFacultyUseCase
  - Create `src/modules/admin/application/Faculty/DeleteFacultyUseCase.ts`
  - Check hasChildDepartments() and hasChildMajors()
  - Apply FacultyPolicy.canDeleteFaculty()
  - Call repository.delete() if allowed
  - Return Result<void>
  - _Requirements: 1.8_

### 8. Application Layer - Department Use Cases

- [x] 8.1 Implement CreateDepartmentUseCase
  - Create `src/modules/admin/application/Department/CreateDepartmentUseCase.ts`
  - Validate parent Faculty exists
  - Check for duplicate code
  - Call repository.create()
  - Return Result<Department>
  - _Requirements: 1.2_

- [x] 8.2 Implement ListDepartmentsUseCase
  - Create `src/modules/admin/application/Department/ListDepartmentsUseCase.ts`
  - Support pagination
  - Support search by name
  - Support filter by facultyId
  - Call repository.findAll() with filters
  - Return PaginatedResult<Department>
  - _Requirements: 1.5, 9.2, 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 8.3 Implement GetDepartmentByIdUseCase
  - Create `src/modules/admin/application/Department/GetDepartmentByIdUseCase.ts`
  - Call repository.findById()
  - Include Faculty context in response
  - Return Result<Department>
  - _Requirements: 1.12, 8.8_

- [x] 8.4 Implement UpdateDepartmentUseCase
  - Create `src/modules/admin/application/Department/UpdateDepartmentUseCase.ts`
  - Validate parent Faculty exists (if facultyId is being changed)
  - Check for duplicate code (if code is being changed)
  - Call repository.update()
  - Return Result<Department>
  - _Requirements: 1.2_

- [x] 8.5 Implement DeleteDepartmentUseCase
  - Create `src/modules/admin/application/Department/DeleteDepartmentUseCase.ts`
  - Check hasLinkedTeachers()
  - Apply DepartmentPolicy.canDeleteDepartment()
  - Call repository.delete() if allowed
  - Return Result<void>
  - _Requirements: 1.9_

### 9. Application Layer - Major Use Cases

- [x] 9.1 Implement CreateMajorUseCase
  - Create `src/modules/admin/application/Major/CreateMajorUseCase.ts`
  - Validate parent Faculty exists
  - Check for duplicate code
  - Call repository.create()
  - Return Result<Major>
  - _Requirements: 1.3_

- [x] 9.2 Implement ListMajorsUseCase
  - Create `src/modules/admin/application/Major/ListMajorsUseCase.ts`
  - Support pagination
  - Support search by name
  - Support filter by facultyId
  - Call repository.findAll() with filters
  - Return PaginatedResult<Major>
  - _Requirements: 1.6, 9.3, 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 9.3 Implement GetMajorByIdUseCase
  - Create `src/modules/admin/application/Major/GetMajorByIdUseCase.ts`
  - Call repository.findById()
  - Include Faculty context in response
  - Return Result<Major>
  - _Requirements: 1.12, 8.9_

- [x] 9.4 Implement UpdateMajorUseCase
  - Create `src/modules/admin/application/Major/UpdateMajorUseCase.ts`
  - Validate parent Faculty exists (if facultyId is being changed)
  - Check for duplicate code (if code is being changed)
  - Call repository.update()
  - Return Result<Major>
  - _Requirements: 1.3_

- [x] 9.5 Implement DeleteMajorUseCase
  - Create `src/modules/admin/application/Major/DeleteMajorUseCase.ts`
  - Check hasChildClasses()
  - Apply MajorPolicy.canDeleteMajor()
  - Call repository.delete() if allowed
  - Return Result<void>
  - _Requirements: 1.10_

### 10. Application Layer - Class Use Cases

- [ ] 10.1 Implement CreateClassUseCase
  - Create `src/modules/admin/application/Class/CreateClassUseCase.ts`
  - Validate parent Major exists
  - Check for duplicate code
  - Call repository.create()
  - Return Result<Class>
  - _Requirements: 1.4_

- [x] 10.2 Implement ListClassesUseCase
  - Create `src/modules/admin/application/Class/ListClassesUseCase.ts`
  - Support pagination
  - Support search by name or code
  - Support filter by majorId
  - Support filter by facultyId (via Major.facultyId)
  - Call repository.findAll() with filters
  - Return PaginatedResult<Class>
  - _Requirements: 1.7, 8.4, 9.4, 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 10.3 Implement GetClassByIdUseCase
  - Create `src/modules/admin/application/Class/GetClassByIdUseCase.ts`
  - Call repository.findById()
  - Include Major and Faculty context in response
  - Return Result<Class>
  - _Requirements: 1.12, 8.10_

- [x] 10.4 Implement UpdateClassUseCase
  - Create `src/modules/admin/application/Class/UpdateClassUseCase.ts`
  - Validate parent Major exists (if majorId is being changed)
  - Check for duplicate code (if code is being changed)
  - Call repository.update()
  - Return Result<Class>
  - _Requirements: 1.4_

- [x] 10.5 Implement DeleteClassUseCase
  - Create `src/modules/admin/application/Class/DeleteClassUseCase.ts`
  - Check hasLinkedStudents()
  - Apply ClassPolicy.canDeleteClass()
  - Call repository.delete() if allowed
  - Return Result<void>
  - _Requirements: 1.11_

### 11. Infrastructure Layer - Faculty Repository

- [x] 11.1 Implement FacultyRepoPrisma
  - Create `src/modules/admin/infra/FacultyRepoPrisma.ts`
  - Implement create() method
  - Implement findById() method
  - Implement findByCode() method for duplicate code checking
  - Implement findAll() with pagination, search, and filters
  - Implement update() method
  - Implement delete() method
  - Implement hasChildDepartments() method (check Department count)
  - Implement hasChildMajors() method (check Major count)
  - Handle Prisma unique constraint violations
  - _Requirements: 1.1, 1.8_

- [ ]* 11.2 Write unit tests for FacultyRepoPrisma
  - Test create with valid data
  - Test create with duplicate code (should throw)
  - Test findAll with pagination
  - Test findAll with search filter
  - Test hasChildDepartments and hasChildMajors
  - Test delete with children (should fail at DB level)

### 12. Infrastructure Layer - Department Repository

- [x] 12.1 Implement DepartmentRepoPrisma
  - Create `src/modules/admin/infra/DepartmentRepoPrisma.ts`
  - Implement create() method with facultyId validation
  - Implement findById() method with Faculty include
  - Implement findByCode() method for duplicate code checking
  - Implement findAll() with pagination, search, facultyId filter, and Faculty include
  - Implement update() method
  - Implement delete() method
  - Implement hasLinkedTeachers() method (TEMPORARY Phase 1 placeholder - returns false until Phase 2 introduces TeacherProfile)
  - Handle Prisma foreign key violations
  - _Requirements: 1.2, 1.5, 1.9, 8.8_

- [ ]* 12.2 Write unit tests for DepartmentRepoPrisma
  - Test create with valid facultyId
  - Test create with invalid facultyId (should throw)
  - Test findAll with facultyId filter
  - Test findById includes Faculty context
  - Test hasLinkedTeachers (returns false in Phase 1)

### 13. Infrastructure Layer - Major Repository

- [x] 13.1 Implement MajorRepoPrisma
  - Create `src/modules/admin/infra/MajorRepoPrisma.ts`
  - Implement create() method with facultyId validation
  - Implement findById() method with Faculty include
  - Implement findByCode() method for duplicate code checking
  - Implement findAll() with pagination, search, facultyId filter, and Faculty include
  - Implement update() method
  - Implement delete() method
  - Implement hasChildClasses() method (check Class count)
  - Handle Prisma foreign key violations
  - _Requirements: 1.3, 1.6, 1.10, 8.9_

- [ ]* 13.2 Write unit tests for MajorRepoPrisma
  - Test create with valid facultyId
  - Test create with invalid facultyId (should throw)
  - Test findAll with facultyId filter
  - Test findById includes Faculty context
  - Test hasChildClasses

### 14. Infrastructure Layer - Class Repository

- [x] 14.1 Implement ClassRepoPrisma
  - Create `src/modules/admin/infra/ClassRepoPrisma.ts`
  - Implement create() method with majorId validation
  - Implement findById() method with Major and Faculty includes (nested)
  - Implement findByCode() method for duplicate code checking
  - Implement findAll() with pagination, search, majorId filter, facultyId filter (via Major), and includes
  - Implement update() method
  - Implement delete() method
  - Implement hasLinkedStudents() method (TEMPORARY Phase 1 placeholder - returns false until Phase 2 introduces StudentProfile)
  - Handle Prisma foreign key violations
  - _Requirements: 1.4, 1.7, 1.11, 8.4, 8.10_

- [ ]* 14.2 Write unit tests for ClassRepoPrisma
  - Test create with valid majorId
  - Test create with invalid majorId (should throw)
  - Test findAll with majorId filter
  - Test findAll with facultyId filter (via Major)
  - Test findById includes Major and Faculty context
  - Test hasLinkedStudents (returns false in Phase 1)

### 15. Delivery Layer - Faculty HTTP

- [x] 15.1 Create Faculty DTOs
  - Create `src/modules/admin/delivery/http/Faculty/Dto.ts`
  - Define CreateFacultyRequestDto with Zod schema (name, code)
  - Define UpdateFacultyRequestDto with Zod schema (name?, code?)
  - Define FacultyResponseDto with OpenAPI annotations
  - Define ListFacultiesQueryDto with pagination and search params
  - Add OpenAPI annotations using @asteasolutions/zod-to-openapi
  - _Requirements: 1.1, 9.1, 14.1, 14.2_

- [x] 15.2 Create Faculty Routes
  - Create `src/modules/admin/delivery/http/Faculty/Routes.ts`
  - POST /api/v1/admin/faculties - create faculty
  - GET /api/v1/admin/faculties - list faculties with pagination and search
  - GET /api/v1/admin/faculties/:id - get faculty by id
  - PUT /api/v1/admin/faculties/:id - update faculty
  - DELETE /api/v1/admin/faculties/:id - delete faculty
  - Add app.auth.verify preHandler for all routes
  - Map application Results to HTTP responses (200, 201, 400, 404, 409, 422)
  - Map domain errors to Vietnamese error responses
  - _Requirements: 1.1, 1.8, 13.1, 13.2_

### 16. Delivery Layer - Department HTTP

- [x] 16.1 Create Department DTOs
  - Create `src/modules/admin/delivery/http/Department/Dto.ts`
  - Define CreateDepartmentRequestDto with Zod schema (name, code, facultyId)
  - Define UpdateDepartmentRequestDto with Zod schema (name?, code?, facultyId?)
  - Define DepartmentResponseDto with Faculty context
  - Define ListDepartmentsQueryDto with pagination, search, and facultyId filter
  - Add OpenAPI annotations
  - _Requirements: 1.2, 1.5, 9.2, 14.1, 14.2_

- [x] 16.2 Create Department Routes
  - Create `src/modules/admin/delivery/http/Department/Routes.ts`
  - POST /api/v1/admin/departments - create department
  - GET /api/v1/admin/departments - list departments with filters
  - GET /api/v1/admin/departments/:id - get department by id
  - PUT /api/v1/admin/departments/:id - update department
  - DELETE /api/v1/admin/departments/:id - delete department
  - Add app.auth.verify preHandler
  - Map Results to HTTP responses
  - Map domain errors to Vietnamese error responses
  - _Requirements: 1.2, 1.5, 1.9, 13.1, 13.2_

### 17. Delivery Layer - Major HTTP

- [x] 17.1 Create Major DTOs
  - Create `src/modules/admin/delivery/http/Major/Dto.ts`
  - Define CreateMajorRequestDto with Zod schema (name, code, facultyId)
  - Define UpdateMajorRequestDto with Zod schema (name?, code?, facultyId?)
  - Define MajorResponseDto with Faculty context
  - Define ListMajorsQueryDto with pagination, search, and facultyId filter
  - Add OpenAPI annotations
  - _Requirements: 1.3, 1.6, 9.3, 14.1, 14.2_

- [x] 17.2 Create Major Routes
  - Create `src/modules/admin/delivery/http/Major/Routes.ts`
  - POST /api/v1/admin/majors - create major
  - GET /api/v1/admin/majors - list majors with filters
  - GET /api/v1/admin/majors/:id - get major by id
  - PUT /api/v1/admin/majors/:id - update major
  - DELETE /api/v1/admin/majors/:id - delete major
  - Add app.auth.verify preHandler
  - Map Results to HTTP responses
  - Map domain errors to Vietnamese error responses
  - _Requirements: 1.3, 1.6, 1.10, 13.1, 13.2_

### 18. Delivery Layer - Class HTTP

- [x] 18.1 Create Class DTOs
  - Create `src/modules/admin/delivery/http/Class/Dto.ts`
  - Define CreateClassRequestDto with Zod schema (name, code, majorId)
  - Define UpdateClassRequestDto with Zod schema (name?, code?, majorId?)
  - Define ClassResponseDto with Major and Faculty context
  - Define ListClassesQueryDto with pagination, search, majorId filter, facultyId filter
  - Add OpenAPI annotations
  - _Requirements: 1.4, 1.7, 8.4, 9.4, 14.1, 14.2_

- [x] 18.2 Create Class Routes
  - Create `src/modules/admin/delivery/http/Class/Routes.ts`
  - POST /api/v1/admin/classes - create academic class
  - GET /api/v1/admin/classes - list classes with filters
  - GET /api/v1/admin/classes/:id - get class by id
  - PUT /api/v1/admin/classes/:id - update class
  - DELETE /api/v1/admin/classes/:id - delete class
  - Add app.auth.verify preHandler
  - Map Results to HTTP responses
  - Map domain errors to Vietnamese error responses
  - _Requirements: 1.4, 1.7, 1.11, 8.4, 13.1, 13.2_

### 19. Container & Dependency Wiring

- [ ] 19.1 Create admin module Container
  - Create `src/modules/admin/Container.ts`
  - Wire FacultyRepoPrisma with PrismaClient
  - Wire DepartmentRepoPrisma with PrismaClient
  - Wire MajorRepoPrisma with PrismaClient
  - Wire ClassRepoPrisma with PrismaClient
  - Wire all Faculty use cases with FacultyRepo
  - Wire all Department use cases with DepartmentRepo
  - Wire all Major use cases with MajorRepo
  - Wire all Class use cases with ClassRepo
  - Export factory functions for use cases
  - _Requirements: All_

- [ ] 19.2 Register admin routes in app
  - Update `src/app.ts` or `src/api/` to register admin routes
  - Register Faculty routes
  - Register Department routes
  - Register Major routes
  - Register Class routes
  - Ensure routes are prefixed with `/api/v1/admin/`
  - _Requirements: All_

### 20. Integration Testing

- [ ]* 20.1 Write API integration tests for Faculty
  - Test POST /api/v1/admin/faculties (create)
  - Test GET /api/v1/admin/faculties (list with pagination)
  - Test GET /api/v1/admin/faculties/:id (get by id)
  - Test PUT /api/v1/admin/faculties/:id (update)
  - Test DELETE /api/v1/admin/faculties/:id (delete)
  - Test DELETE with children (should return 422)
  - Test duplicate code (should return 409)

- [ ]* 20.2 Write API integration tests for Department
  - Test POST /api/v1/admin/departments (create with facultyId)
  - Test GET /api/v1/admin/departments?facultyId=X (filter by faculty)
  - Test GET /api/v1/admin/departments/:id (includes Faculty context)
  - Test PUT /api/v1/admin/departments/:id (update)
  - Test DELETE /api/v1/admin/departments/:id (delete)
  - Test create with invalid facultyId (should return 400)

- [ ]* 20.3 Write API integration tests for Major
  - Test POST /api/v1/admin/majors (create with facultyId)
  - Test GET /api/v1/admin/majors?facultyId=X (filter by faculty)
  - Test GET /api/v1/admin/majors/:id (includes Faculty context)
  - Test PUT /api/v1/admin/majors/:id (update)
  - Test DELETE /api/v1/admin/majors/:id (delete)
  - Test DELETE with children (should return 422)

- [ ]* 20.4 Write API integration tests for Class
  - Test POST /api/v1/admin/classes (create with majorId)
  - Test GET /api/v1/admin/classes?majorId=X (filter by major)
  - Test GET /api/v1/admin/classes?facultyId=X (filter by faculty via major)
  - Test GET /api/v1/admin/classes/:id (includes Major and Faculty context)
  - Test PUT /api/v1/admin/classes/:id (update)
  - Test DELETE /api/v1/admin/classes/:id (delete)

### 21. Final Checkpoint

- [x] 21.1 Verify all Phase 1 functionality
  - Run all tests and ensure they pass
  - Manually test all CRUD operations via Swagger UI
  - Verify hierarchy validation works correctly
  - Verify deletion rules are enforced
  - Verify pagination works for all list endpoints
  - Verify search works for all entities
  - Verify hierarchical filtering works correctly
  - Verify Vietnamese error messages are displayed
  - Ask the user if questions arise

---

## Notes

- **Tasks marked with `*` are optional** and can be skipped for faster MVP delivery
- **Each task references specific requirements** for traceability
- **Checkpoints ensure incremental validation** at reasonable breaks
- **Phase 1 focuses ONLY on academic structure** - no accounts, profiles, or linking
- **Corrected hierarchy**: Major belongs to Faculty (not Department)
- **Deletion behavior**: RESTRICT (reject deletion when children exist, not SET NULL)
- **All user-facing errors must be in Vietnamese**
- **All routes must use `app.auth.verify` preHandler** for authentication
- **Use TypeScript throughout** with strict Clean Architecture boundaries
- **Import paths must use `.js` extensions** (ESM NodeNext requirement)

---

## Success Criteria

Phase 1 is complete when:
1. ✅ All four academic structure entities (Faculty, Department, Major, Class) can be created, read, updated, and deleted via API
2. ✅ Hierarchy validation prevents invalid parent references
3. ✅ Deletion rules prevent orphaned data (reject deletion when children exist)
4. ✅ List endpoints support pagination, search, and hierarchical filtering
5. ✅ All error messages are in Vietnamese
6. ✅ All routes are authenticated with JWT
7. ✅ Swagger documentation is generated for all endpoints
8. ✅ Integration tests pass for all CRUD operations
