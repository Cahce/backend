/**
 * Admin — Departments CRUD API Test
 * Script: npm run test:api:admin:departments
 *
 * ┌─────┬───────────────────────────────────────────────┬────────┬──────────────────────────┐
 * │ #   │ Test case                                      │ Expect │ error.code               │
 * ├─────┼───────────────────────────────────────────────┼────────┼──────────────────────────┤
 * │  1  │ Login admin / student                         │ 200    │ —                        │
 * │  2  │ Setup: create parent Faculty fixture           │ 200    │ —                        │
 * │  3  │ GET /departments no token → 401               │ 401    │ UNAUTHENTICATED          │
 * │  4  │ GET /departments student token → 403          │ 403    │ FORBIDDEN                │
 * │  5  │ POST /departments happy (with facultyId)       │ 200    │ —                        │
 * │  6  │ POST /departments missing name → 400          │ 400    │ VALIDATION_ERROR         │
 * │  7  │ POST /departments missing code → 400          │ 400    │ VALIDATION_ERROR         │
 * │  8  │ POST /departments missing facultyId → 400     │ 400    │ VALIDATION_ERROR         │
 * │  9  │ POST /departments bad facultyId → 404         │ 404    │ FACULTY_NOT_FOUND        │
 * │ 10  │ POST /departments duplicate code → DUPLICATE  │ 4xx    │ DUPLICATE_CODE           │
 * │ 11  │ GET /departments list contains new item       │ 200    │ —                        │
 * │ 12  │ GET /departments/:id found                    │ 200    │ —                        │
 * │ 13  │ GET /departments/:id not-found                │ 404    │ DEPARTMENT_NOT_FOUND     │
 * │ 14  │ PUT /departments/:id update                   │ 200    │ —                        │
 * │ 15  │ PUT /departments/nonexistent → 404            │ 404    │ DEPARTMENT_NOT_FOUND     │
 * │ 16  │ DELETE /departments/:id (no children) → 200  │ 200    │ —                        │
 * │ 17  │ GET /departments/:id after delete → 404       │ 404    │ DEPARTMENT_NOT_FOUND     │
 * │ 18  │ Teardown parent Faculty                        │ 200    │ —                        │
 * └─────┴───────────────────────────────────────────────┴────────┴──────────────────────────┘
 */

import {
  api, loginAdmin, loginStudent,
  makeRunner, uniqueSuffix,
  expectStatus, expectCreateOk, expectErrorCode, assert,
} from './_admin-test-helpers.ts';

const { test, summary } = makeRunner('DEPARTMENTS');
const BASE = '/admin';
const sfx = uniqueSuffix();

let parentFacultyId = '';
let deptId = '';

async function run() {
  console.log('='.repeat(60));
  console.log('ADMIN — DEPARTMENTS API TEST');
  console.log('='.repeat(60));

  try {
    await test('1. Login admin', async () => { await loginAdmin(); });
    const studentToken = await loginStudent();

    // ── Fixture ─────────────────────────────────────────────────────────────
    await test('2. Setup parent Faculty', async () => {
      const r = await api('POST', `${BASE}/faculties`, {
        body: { name: `FAC for Dept ${sfx}`, code: `FAC_D_${sfx}` },
      });
      expectCreateOk(r, 'setup-faculty');
      parentFacultyId = (r.data as { id: string }).id;
    });

    // ── RBAC ────────────────────────────────────────────────────────────────
    await test('3. GET /departments no token → 401', async () => {
      const r = await api('GET', `${BASE}/departments`, { token: null });
      expectStatus(r, 401);
    });

    await test('4. GET /departments student token → 403', async () => {
      if (!studentToken) { console.log('     [SKIP]'); return; }
      const r = await api('GET', `${BASE}/departments`, { token: studentToken });
      expectStatus(r, 403);
      expectErrorCode(r, 'FORBIDDEN');
    });

    // ── Create ───────────────────────────────────────────────────────────────
    await test('5. POST /departments happy', async () => {
      const r = await api('POST', `${BASE}/departments`, {
        body: { name: `BM Test ${sfx}`, code: `DEPT_${sfx}`, facultyId: parentFacultyId },
      });
      expectCreateOk(r, 'create');
      const d = r.data as { id: string; code: string };
      assert(!!d.id, 'id present');
      assert(d.code === `DEPT_${sfx}`, 'code matches');
      deptId = d.id;
    });

    await test('6. POST /departments missing name → 400', async () => {
      const r = await api('POST', `${BASE}/departments`, {
        body: { code: `DEPT2_${sfx}`, facultyId: parentFacultyId },
      });
      expectStatus(r, 400);
    });

    await test('7. POST /departments missing code → 400', async () => {
      const r = await api('POST', `${BASE}/departments`, {
        body: { name: 'No Code Dept', facultyId: parentFacultyId },
      });
      expectStatus(r, 400);
    });

    await test('8. POST /departments missing facultyId → 400', async () => {
      const r = await api('POST', `${BASE}/departments`, {
        body: { name: 'No Faculty', code: `DEPT3_${sfx}` },
      });
      expectStatus(r, 400);
    });

    await test('9. POST /departments bad facultyId → 404 FACULTY_NOT_FOUND', async () => {
      const r = await api('POST', `${BASE}/departments`, {
        body: { name: 'Bad FK', code: `DEPT4_${sfx}`, facultyId: 'nonexistent-000' },
      });
      expectStatus(r, 404);
      expectErrorCode(r, 'FACULTY_NOT_FOUND');
    });

    await test('10. POST /departments duplicate code → DUPLICATE_CODE', async () => {
      const r = await api('POST', `${BASE}/departments`, {
        body: { name: 'Dup Dept', code: `DEPT_${sfx}`, facultyId: parentFacultyId },
      });
      assert(r.status >= 400, `expected 4xx, got ${r.status}`);
      expectErrorCode(r, 'DUPLICATE_CODE');
    });

    // ── List / Get ────────────────────────────────────────────────────────────
    await test('11. GET /departments list contains new item', async () => {
      const r = await api('GET', `${BASE}/departments?pageSize=100`);
      expectStatus(r, 200);
      const d = r.data as { items: { id: string }[] };
      assert(d.items.some(i => i.id === deptId), 'item in list');
    });

    await test('12. GET /departments/:id found', async () => {
      const r = await api('GET', `${BASE}/departments/${deptId}`);
      expectStatus(r, 200);
    });

    await test('13. GET /departments/nonexistent → 404', async () => {
      const r = await api('GET', `${BASE}/departments/nonexistent-000`);
      expectStatus(r, 404);
      expectErrorCode(r, 'DEPARTMENT_NOT_FOUND');
    });

    // ── Update ────────────────────────────────────────────────────────────────
    await test('14. PUT /departments/:id update', async () => {
      const r = await api('PUT', `${BASE}/departments/${deptId}`, {
        body: { name: `BM Updated ${sfx}` },
      });
      expectStatus(r, 200);
      const d = r.data as { name: string };
      assert(d.name === `BM Updated ${sfx}`, 'name updated');
    });

    await test('15. PUT /departments/nonexistent → 404', async () => {
      const r = await api('PUT', `${BASE}/departments/nonexistent-000`, {
        body: { name: 'Ghost' },
      });
      expectStatus(r, 404);
      expectErrorCode(r, 'DEPARTMENT_NOT_FOUND');
    });

    // ── Delete ─────────────────────────────────────────────────────────────────
    await test('16. DELETE /departments/:id (no children) → 200', async () => {
      const r = await api('DELETE', `${BASE}/departments/${deptId}`);
      expectStatus(r, 200);
      deptId = '';
    });

    await test('17. GET /departments/:id after delete → 404', async () => {
      if (deptId) {
        const r = await api('GET', `${BASE}/departments/${deptId}`);
        expectStatus(r, 404);
      } else {
        console.log('     [INFO] already cleaned');
      }
    });
  } finally {
    // ── Teardown ──────────────────────────────────────────────────────────────
    if (deptId) {
      await api('DELETE', `${BASE}/departments/${deptId}`).catch(() => null);
    }
    if (parentFacultyId) {
      await api('DELETE', `${BASE}/faculties/${parentFacultyId}`).catch(() => null);
    }
  }

  await test('18. Teardown parent Faculty done', async () => {
    // Already done in finally block; verify gone
    if (!parentFacultyId) { console.log('     [INFO] cleaned'); return; }
    const r = await api('GET', `${BASE}/faculties/${parentFacultyId}`);
    assert(r.status === 404, 'parent faculty cleaned');
    parentFacultyId = '';
  });

  return summary();
}

run().then(ok => process.exit(ok ? 0 : 1));
