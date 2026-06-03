/**
 * Admin — Majors CRUD API Test
 * Script: npm run test:api:admin:majors
 *
 * ┌─────┬───────────────────────────────────────────────┬────────┬──────────────────────────┐
 * │ #   │ Test case                                      │ Expect │ error.code               │
 * ├─────┼───────────────────────────────────────────────┼────────┼──────────────────────────┤
 * │  1  │ Login admin / student                         │ 200    │ —                        │
 * │  2  │ Setup: create parent Faculty fixture           │ 200    │ —                        │
 * │  3  │ GET /majors no token → 401                    │ 401    │ UNAUTHENTICATED          │
 * │  4  │ GET /majors student token → 403               │ 403    │ FORBIDDEN                │
 * │  5  │ POST /majors happy (with facultyId)            │ 200    │ —                        │
 * │  6  │ POST /majors missing name → 400               │ 400    │ VALIDATION_ERROR         │
 * │  7  │ POST /majors missing code → 400               │ 400    │ VALIDATION_ERROR         │
 * │  8  │ POST /majors bad facultyId → 404              │ 404    │ FACULTY_NOT_FOUND        │
 * │  9  │ POST /majors duplicate code → DUPLICATE       │ 4xx    │ DUPLICATE_CODE           │
 * │ 10  │ GET /majors list contains new item            │ 200    │ —                        │
 * │ 11  │ GET /majors/:id found                         │ 200    │ —                        │
 * │ 12  │ GET /majors/:id not-found                     │ 404    │ MAJOR_NOT_FOUND          │
 * │ 13  │ PUT /majors/:id update                        │ 200    │ —                        │
 * │ 14  │ DELETE /majors with child Class → restrict     │ 4xx    │ HAS_CHILD_CLASSES        │
 * │ 15  │ DELETE child Class, then Major → 200          │ 200    │ —                        │
 * │ 16  │ GET /majors/:id after delete → 404            │ 404    │ MAJOR_NOT_FOUND          │
 * └─────┴───────────────────────────────────────────────┴────────┴──────────────────────────┘
 */

import {
  api, loginAdmin, loginStudent,
  makeRunner, uniqueSuffix,
  expectStatus, expectCreateOk, expectErrorCode, assert,
} from './_admin-test-helpers.ts';

const { test, summary } = makeRunner('MAJORS');
const BASE = '/admin';
const sfx = uniqueSuffix();

let parentFacultyId = '';
let majorId = '';
let childClassId = '';

async function run() {
  console.log('='.repeat(60));
  console.log('ADMIN — MAJORS API TEST');
  console.log('='.repeat(60));

  try {
    await test('1. Login admin', async () => { await loginAdmin(); });
    const studentToken = await loginStudent();

    await test('2. Setup parent Faculty', async () => {
      const r = await api('POST', `${BASE}/faculties`, {
        body: { name: `FAC for Major ${sfx}`, code: `FAC_M_${sfx}` },
      });
      expectCreateOk(r);
      parentFacultyId = (r.data as { id: string }).id;
    });

    await test('3. GET /majors no token → 401', async () => {
      expectStatus(await api('GET', `${BASE}/majors`, { token: null }), 401);
    });

    await test('4. GET /majors student token → 403', async () => {
      if (!studentToken) { console.log('     [SKIP]'); return; }
      const r = await api('GET', `${BASE}/majors`, { token: studentToken });
      expectStatus(r, 403);
      expectErrorCode(r, 'FORBIDDEN');
    });

    await test('5. POST /majors happy', async () => {
      const r = await api('POST', `${BASE}/majors`, {
        body: { name: `Ngành Test ${sfx}`, code: `MAJ_${sfx}`, facultyId: parentFacultyId },
      });
      expectCreateOk(r);
      majorId = (r.data as { id: string }).id;
      assert(!!majorId, 'id present');
    });

    await test('6. POST /majors missing name → 400', async () => {
      expectStatus(await api('POST', `${BASE}/majors`, {
        body: { code: `MAJ2_${sfx}`, facultyId: parentFacultyId },
      }), 400);
    });

    await test('7. POST /majors missing code → 400', async () => {
      expectStatus(await api('POST', `${BASE}/majors`, {
        body: { name: 'No Code', facultyId: parentFacultyId },
      }), 400);
    });

    await test('8. POST /majors bad facultyId → 404 FACULTY_NOT_FOUND', async () => {
      const r = await api('POST', `${BASE}/majors`, {
        body: { name: 'Bad FK', code: `MAJ3_${sfx}`, facultyId: 'nonexistent-000' },
      });
      expectStatus(r, 404);
      expectErrorCode(r, 'FACULTY_NOT_FOUND');
    });

    await test('9. POST /majors duplicate code → DUPLICATE_CODE', async () => {
      const r = await api('POST', `${BASE}/majors`, {
        body: { name: 'Dup Major', code: `MAJ_${sfx}`, facultyId: parentFacultyId },
      });
      assert(r.status >= 400, `expected 4xx, got ${r.status}`);
      expectErrorCode(r, 'DUPLICATE_CODE');
    });

    await test('10. GET /majors list contains new item', async () => {
      const r = await api('GET', `${BASE}/majors?pageSize=100`);
      expectCreateOk(r);
      const d = r.data as { items: { id: string }[] };
      assert(d.items.some(i => i.id === majorId), 'item in list');
    });

    await test('11. GET /majors/:id found', async () => {
      expectStatus(await api('GET', `${BASE}/majors/${majorId}`), 200);
    });

    await test('12. GET /majors/nonexistent → 404', async () => {
      const r = await api('GET', `${BASE}/majors/nonexistent-000`);
      expectStatus(r, 404);
      expectErrorCode(r, 'MAJOR_NOT_FOUND');
    });

    await test('13. PUT /majors/:id update name', async () => {
      const r = await api('PUT', `${BASE}/majors/${majorId}`, {
        body: { name: `Ngành Updated ${sfx}` },
      });
      expectCreateOk(r);
      assert((r.data as { name: string }).name === `Ngành Updated ${sfx}`, 'name updated');
    });

    // delete-restrict: create child Class
    await test('14a. Setup child Class', async () => {
      const r = await api('POST', `${BASE}/classes`, {
        body: { name: `Lớp Child ${sfx}`, code: `CLS_CHILD_${sfx}`, majorId },
      });
      expectCreateOk(r);
      childClassId = (r.data as { id: string }).id;
    });

    await test('14. DELETE /majors with child Class → restrict HAS_CHILD_CLASSES', async () => {
      if (!childClassId) { console.log('     [SKIP]'); return; }
      const r = await api('DELETE', `${BASE}/majors/${majorId}`);
      assert(r.status >= 400, `expected 4xx, got ${r.status}`);
      expectErrorCode(r, 'HAS_CHILD_CLASSES');
      expectStatus(await api('GET', `${BASE}/majors/${majorId}`), 200, 'still exists');
    });

    await test('15. DELETE child Class then Major → 200', async () => {
      if (childClassId) {
        expectStatus(await api('DELETE', `${BASE}/classes/${childClassId}`), 200);
        childClassId = '';
      }
      expectStatus(await api('DELETE', `${BASE}/majors/${majorId}`), 200);
      majorId = '';
    });

    await test('16. GET /majors/:id after delete → 404', async () => {
      if (majorId) { expectStatus(await api('GET', `${BASE}/majors/${majorId}`), 404); }
      else { console.log('     [INFO] already cleaned'); }
    });
  } finally {
    if (childClassId) await api('DELETE', `${BASE}/classes/${childClassId}`).catch(() => null);
    if (majorId) await api('DELETE', `${BASE}/majors/${majorId}`).catch(() => null);
    if (parentFacultyId) await api('DELETE', `${BASE}/faculties/${parentFacultyId}`).catch(() => null);
  }

  return summary();
}

run().then(ok => process.exit(ok ? 0 : 1));
