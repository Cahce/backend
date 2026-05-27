# Tasks — Template Project Materialization Fix

**Status**: Most P1 and P2 issues fixed. Remaining: P2.7 (entryPath implementation).

See `FIXES_COMPLETED.md` for details on completed fixes.

---

## T1. Implement entryPath from template version

**Intent**: Get entryPath from template version and use it instead of hardcoded 'main.typ'.

**Problem**: Currently `CreateProjectUseCase` hardcodes `mainPath = 'main.typ'`, ignoring the template's actual entry file path.

**Solution**:
1. Update `MaterializeTemplateVersionUseCase` to return `entryPath` along with files
2. Update `MaterializeTemplate` interface to include `entryPath` in result
3. Update `CreateProjectUseCase` to use returned `entryPath`

**Files**:
- `src/modules/projects/domain/MaterializeTemplate.ts` (interface)
- `src/modules/templates/application/MaterializeTemplateVersionUseCase.ts`
- `src/modules/templates/Container.ts`
- `src/modules/projects/application/CreateProjectUseCase.ts`

**Sub-tasks**:
- [x] T1.1: Update MaterializeTemplate interface to return `{ files, entryPath }`
- [x] T1.2: Update MaterializeTemplateVersionUseCase to return entryPath from template version
- [x] T1.3: Update TemplatesContainer.getMaterializeFunction() to return new shape
- [x] T1.4: Update CreateProjectUseCase to use returned entryPath
- [x] T1.5: Update tests to handle new interface

**Acceptance**:
- MaterializeTemplate interface returns `{ files: MaterializedFile[]; entryPath: string }`
- MaterializeTemplateVersionUseCase reads entryPath from template version
- CreateProjectUseCase uses returned entryPath instead of hardcoded 'main.typ'
- All existing tests pass
- Build passes without errors

**Verify**:
```powershell
cd d:\DATN\code\backend
npm run build
npm run test:unit:templates
npm run test:unit:projects
```

---

## T2. Add integration tests for template materialization

**Intent**: Verify end-to-end template materialization with entryPath.

**Files**:
- `src/modules/projects/__tests__/CreateProjectWithTemplate.test.ts` (new)

**Test cases**:
- Create project with template that has custom entryPath
- Verify project settings use correct entryPath
- Verify files are materialized correctly

**Acceptance**:
- Tests verify entryPath is correctly propagated
- Tests pass

**Verify**:
```powershell
cd d:\DATN\code\backend
npm run test:unit:projects
```

---

## Verification Roll-Up

When T1-T2 complete, run:

```powershell
cd d:\DATN\code\backend

# Build
npm run build

# Unit tests
npm run test:unit:templates
npm run test:unit:projects

# Manual test via Swagger
npm run dev
# Then test in browser at http://localhost:3000/docs
```

All should pass without errors.

---

## Success Criteria

- ✅ Build passes
- ✅ All unit tests pass
- ✅ entryPath correctly propagated from template to project settings
- ✅ No hardcoded 'main.typ' in materialization flow
- ✅ Backward compatibility maintained (templates without entryPath default to 'main.typ')

