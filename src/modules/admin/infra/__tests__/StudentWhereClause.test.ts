/**
 * Unit tests for buildStudentWhereClause — the student list filter builder.
 *
 * Regression guard for the majorId+facultyId overwrite bug: both filters scope
 * the related class, so both must survive when supplied together.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentWhereClause } from '../StudentProfileRepoPrisma.js';
import type { StudentFilters } from '../../domain/StudentManagement/Types.js';

test('majorId + facultyId are BOTH applied (regression: no silent overwrite)', () => {
  const filters = { majorId: 'major-1', facultyId: 'faculty-1' } as StudentFilters;
  const where = buildStudentWhereClause(filters);

  assert.deepEqual(where.class, {
    majorId: 'major-1',
    major: { facultyId: 'faculty-1' },
  });
});

test('majorId only → class scoped by majorId', () => {
  const where = buildStudentWhereClause({ majorId: 'major-1' } as StudentFilters);
  assert.deepEqual(where.class, { majorId: 'major-1' });
});

test('facultyId only → class scoped by major.facultyId', () => {
  const where = buildStudentWhereClause({ facultyId: 'faculty-1' } as StudentFilters);
  assert.deepEqual(where.class, { major: { facultyId: 'faculty-1' } });
});

test('no class filters → where.class is undefined', () => {
  const where = buildStudentWhereClause({} as StudentFilters);
  assert.equal(where.class, undefined);
});

test('classId is independent and coexists with major/faculty scoping', () => {
  const where = buildStudentWhereClause({
    classId: 'class-1',
    majorId: 'major-1',
    facultyId: 'faculty-1',
  } as StudentFilters);

  assert.equal(where.classId, 'class-1');
  assert.deepEqual(where.class, {
    majorId: 'major-1',
    major: { facultyId: 'faculty-1' },
  });
});

test('search builds a case-insensitive OR over fullName and studentCode', () => {
  const where = buildStudentWhereClause({ search: 'abc' } as StudentFilters);
  assert.deepEqual(where.OR, [
    { fullName: { contains: 'abc', mode: 'insensitive' } },
    { studentCode: { contains: 'abc', mode: 'insensitive' } },
  ]);
});

test('hasAccount=false filters to null accountId; true filters to not-null', () => {
  assert.deepEqual(buildStudentWhereClause({ hasAccount: false } as StudentFilters).accountId, null);
  assert.deepEqual(buildStudentWhereClause({ hasAccount: true } as StudentFilters).accountId, { not: null });
});
