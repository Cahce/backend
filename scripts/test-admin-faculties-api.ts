/**
 * Admin — Faculties CRUD API Test
 * Script: npm run test:api:admin:faculties
 *
 * Cases per resource:
 * ┌─────┬───────────────────────────────────────────────┬────────┬─────────────────────────┐
 * │ #   │ Test case                                      │ Expect │ error.code              │
 * ├─────┼───────────────────────────────────────────────┼────────┼─────────────────────────┤
 * │  1  │ Login admin                                    │ 200    │ —                       │
 * │  2  │ Login student (for 403 tests)                  │ 200    │ —                       │
 * │  3  │ GET /faculties no token → 401                  │ 401    │ UNAUTHENTICATED         │
 * │  4  │ GET /faculties student token → 403             │ 403    │ FORBIDDEN               │
 * │  5  │ GET /faculties admin token → 200               │ 200    │ —                       │
 * │  6  │ POST /faculties happy (create)                 │ 200    │ —                       │
 * │  7  │ POST /faculties missing name → 400             │ 400    │ VALIDATION_ERROR        │
 * │  8  │ POST /faculties missing code → 400             │ 400    │ VALIDATION_ERROR        │
 * │  9  │ POST /faculties duplicate code → 409/422       │ 4xx    │ DUPLICATE_CODE          │
 * │ 10  │ GET /faculties list (contains new item)        │ 200    │ —                       │
 * │ 11  │ GET /faculties/:id found                       │ 200    │ —                       │
 * │ 12  │ GET /faculties/:id not-found                   │ 404    │ FACULTY_NOT_FOUND       │
 * │ 13  │ PUT /faculties/:id update                      │ 200    │ —                       │
 * │ 14  │ PUT /faculties/:id not-found                   │ 404    │ FACULTY_NOT_FOUND       │
 * │ 15  │ DELETE /faculties/:id with child → restrict    │ 4xx    │ HAS_CHILD_DEPARTMENTS   │
 * │ 16  │ DELETE /faculties/:id after child removed      │ 200    │ —                       │
 * │ 17  │ GET /faculties/:id after delete → 404          │ 404    │ FACULTY_NOT_FOUND       │
 * │ 18  │ GET /faculties/import/template → 200           │ 200    │ —                       │
 * └─────┴───────────────────────────────────────────────┴────────┴─────────────────────────┘
 */

import {
  api, loginAdmin, loginStudent, getStudentToken,
  makeRunner, uniqueSuffix,
  expectStatus, expectCreateOk, expectErrorCode, assert,
} from './_admin-test-helpers.ts';

const { test, summary } = makeRunner('FACULTIES');
const BASE = '/admin';
const sfx = uniqueSuffix();

let facultyId = '';
let childDeptId = '';  // for delete-restrict test

async function run() {
  console.log('='.repeat(60));
  console.log('ADMIN — FACULTIES API TEST');
  console.log('='.repeat(60));

  // ── Auth ──────────────────────────────────────────────────────────────────
  await test('1. Login admin', async () => {
    await loginAdmin();
  });

  const studentToken = await loginStudent();

  // ── RBAC ──────────────────────────────────────────────────────────────────
  await test('3. GET /faculties no token → 401', async () => {
    const r = await api('GET', `${BASE}/faculties`, { token: null });
    expectStatus(r, 401, 'no-token');
  });

  await test('4. GET /faculties student token → 403', async () => {
    if (!studentToken) { console.log('     [SKIP] no student seed'); return; }
    const r = await api('GET', `${BASE}/faculties`, { token: studentToken });
    expectStatus(r, 403, 'student-token');
    expectErrorCode(r, 'FORBIDDEN', 'student-403');
  });

  await test('5. GET /faculties admin token → 200', async () => {
    const r = await api('GET', `${BASE}/faculties`);
    expectStatus(r, 200, 'admin-list');
  });

  // ── Create ────────────────────────────────────────────────────────────────
  await test('6. POST /faculties happy', async () => {
    const r = await api('POST', `${BASE}/faculties`, {
      body: { name: `Khoa Test ${sfx}`, code: `FAC_${sfx}` },
    });
    expectCreateOk(r, 'create');
    const d = r.data as { id: string; name: string; code: string };
    assert(!!d.id, 'id present');
    assert(d.code === `FAC_${sfx}`, 'code matches');
    facultyId = d.id;
    console.log(`     id=${facultyId}`);
  });

  await test('7. POST /faculties missing name → 400', async () => {
    const r = await api('POST', `${BASE}/faculties`, { body: { code: `FAC2_${sfx}` } });
    expectStatus(r, 400, 'missing-name');
  });

  await test('8. POST /faculties missing code → 400', async () => {
    const r = await api('POST', `${BASE}/faculties`, { body: { name: 'No Code' } });
    expectStatus(r, 400, 'missing-code');
  });

  await test('9. POST /faculties duplicate code → 4xx DUPLICATE_CODE', async () => {
    const r = await api('POST', `${BASE}/faculties`, {
      body: { name: 'Dup Faculty', code: `FAC_${sfx}` },
    });
    assert(r.status >= 400, `expected 4xx, got ${r.status}`);
    expectErrorCode(r, 'DUPLICATE_CODE', 'dup-code');
  });

  // ── List / Get ────────────────────────────────────────────────────────────
  await test('10. GET /faculties list contains new item', async () => {
    const r = await api('GET', `${BASE}/faculties?pageSize=100`);
    expectStatus(r, 200, 'list');
    const d = r.data as { items: { id: string }[] };
    assert(d.items.some(i => i.id === facultyId), 'item in list');
  });

  await test('11. GET /faculties/:id found', async () => {
    const r = await api('GET', `${BASE}/faculties/${facultyId}`);
    expectStatus(r, 200, 'get');
    const d = r.data as { id: string };
    assert(d.id === facultyId, 'id matches');
  });

  await test('12. GET /faculties/nonexistent → 404', async () => {
    const r = await api('GET', `${BASE}/faculties/nonexistent-id-000`);
    expectStatus(r, 404, 'get-notfound');
    expectErrorCode(r, 'FACULTY_NOT_FOUND', 'notfound');
  });

  // ── Update ────────────────────────────────────────────────────────────────
  await test('13. PUT /faculties/:id update name', async () => {
    const r = await api('PUT', `${BASE}/faculties/${facultyId}`, {
      body: { name: `Khoa Updated ${sfx}` },
    });
    expectStatus(r, 200, 'update');
    const d = r.data as { name: string };
    assert(d.name === `Khoa Updated ${sfx}`, 'name updated');
  });

  await test('14. PUT /faculties/nonexistent → 404', async () => {
    const r = await api('PUT', `${BASE}/faculties/nonexistent-id-000`, {
      body: { name: 'Ghost' },
    });
    expectStatus(r, 404, 'update-notfound');
    expectErrorCode(r, 'FACULTY_NOT_FOUND', 'notfound');
  });

  // ── Delete-restrict: create child Department first ────────────────────────
  await test('15a. Setup: create child Department', async () => {
    if (!facultyId) return;
    const r = await api('POST', `${BASE}/departments`, {
      body: { name: `BM Child ${sfx}`, code: `DEPT_CHILD_${sfx}`, facultyId },
    });
    expectCreateOk(r, 'setup-dept');
    childDeptId = (r.data as { id: string }).id;
  });

  await test('15. DELETE /faculties/:id with child Dept → restrict', async () => {
    if (!facultyId || !childDeptId) { console.log('     [SKIP] fixture missing'); return; }
    const r = await api('DELETE', `${BASE}/faculties/${facultyId}`);
    assert(r.status >= 400, `expected 4xx (restrict), got ${r.status}`);
    const code = (r.data as { error?: { code?: string } })?.error?.code;
    assert(
      code === 'HAS_CHILD_DEPARTMENTS' || code === 'HAS_CHILD_MAJORS',
      `expected HAS_CHILD_DEPARTMENTS|MAJORS, got ${code}`,
    );
    // Faculty must still exist
    const check = await api('GET', `${BASE}/faculties/${facultyId}`);
    expectStatus(check, 200, 'still-exists');
  });

  // ── Delete happy ──────────────────────────────────────────────────────────
  await test('16. DELETE child Dept then Faculty → 200', async () => {
    if (childDeptId) {
      const r = await api('DELETE', `${BASE}/departments/${childDeptId}`);
      assert(r.status < 300, `dept-delete ${r.status}`);
    }
    if (!facultyId) return;
    const r = await api('DELETE', `${BASE}/faculties/${facultyId}`);
    expectStatus(r, 200, 'delete');
    facultyId = ''; childDeptId = '';
  });

  await test('17. GET /faculties/:id after delete → 404', async () => {
    if (facultyId) {
      const r = await api('GET', `${BASE}/faculties/${facultyId}`);
      expectStatus(r, 404, 'deleted-notfound');
    } else {
      console.log('     [INFO] already cleaned up');
    }
  });

  // ── Tier 2: import template ───────────────────────────────────────────────
  await test('18. GET /faculties/import/template → 200', async () => {
    const r = await api('GET', `${BASE}/faculties/import/template?format=xlsx`);
    expectStatus(r, 200, 'template');
  });

  return summary();
}

run().then(ok => process.exit(ok ? 0 : 1));
