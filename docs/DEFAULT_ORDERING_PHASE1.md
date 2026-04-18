# Default Ordering Rule for Phase 1 List Endpoints

## Overview

All Phase 1 list endpoints for academic structure entities now return results ordered by `updatedAt` descending by default. This means the most recently updated records appear first.

## Affected Entities

- **Faculties** - `/api/v1/admin/faculties`
- **Departments** - `/api/v1/admin/departments`
- **Majors** - `/api/v1/admin/majors`
- **Classes** - `/api/v1/admin/classes`

## Implementation Details

### Default Ordering Behavior

All list endpoints use:
```typescript
orderBy: { updatedAt: 'desc' }
```

This ensures:
- Newest updated records appear first
- Consistent ordering across all list endpoints
- Predictable behavior for frontend pagination

### Repository Implementation

When implementing repository `findAll()` methods in the infrastructure layer, use:

```typescript
const items = await prisma.faculty.findMany({
  where: whereClause,
  orderBy: { updatedAt: 'desc' },  // Default ordering
  skip: (page - 1) * pageSize,
  take: pageSize,
});
```

### Future Enhancements

Phase 1 uses a fixed default ordering. Future phases may add:
- Custom `sortBy` parameter (e.g., `name`, `code`, `createdAt`, `updatedAt`)
- Custom `sortOrder` parameter (`asc` or `desc`)
- Multiple sort fields

For now, keep the implementation simple with the fixed default.

## Files Changed

### Domain Layer - Type Documentation

1. **src/modules/admin/domain/Faculty/Types.ts**
   - Updated `FacultyFilters` type documentation

2. **src/modules/admin/domain/Department/Types.ts**
   - Updated `DepartmentFilters` type documentation

3. **src/modules/admin/domain/Major/Types.ts**
   - Updated `MajorFilters` type documentation

4. **src/modules/admin/domain/Class/Types.ts**
   - Updated `ClassFilters` type documentation

### Domain Layer - Port Documentation

5. **src/modules/admin/domain/Faculty/Ports.ts**
   - Updated `findAll()` method documentation

6. **src/modules/admin/domain/Department/Ports.ts**
   - Updated `findAll()` method documentation

7. **src/modules/admin/domain/Major/Ports.ts**
   - Updated `findAll()` method documentation

8. **src/modules/admin/domain/Class/Ports.ts**
   - Updated `findAll()` method documentation

## Documentation Updates

All affected interfaces and types now include:
- Clear documentation that results are ordered by `updatedAt` descending
- Explicit mention that newest updated records appear first
- Consistent wording across all entity types

## Next Steps

When implementing repository classes in the infrastructure layer:
1. Add `orderBy: { updatedAt: 'desc' }` to all `findAll()` Prisma queries
2. Ensure this ordering is applied consistently across all four entities
3. Test that pagination works correctly with the default ordering

## Example Usage

```typescript
// Frontend receives results ordered by most recently updated first
const response = await fetch('/api/v1/admin/faculties?page=1&pageSize=20');
const data = await response.json();

// data.items[0] is the most recently updated faculty
// data.items[1] is the second most recently updated faculty
// etc.
```

## Verification

All changes have been verified:
- ✅ TypeScript compilation passes
- ✅ No breaking changes to existing interfaces
- ✅ Documentation is consistent across all entity types
- ✅ Ready for repository implementation in tasks 11-14
