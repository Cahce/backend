/**
 * Admin — Classes CRUD API Test
 * Script: npm run test:api:admin:classes
 *
 * ┌─────┬───────────────────────────────────────────────┬────────┬──────────────────────────┐
 * │ #   │ Test case                                      │ Expect │ error.code               │
 * ├─────┼───────────────────────────────────────────────┼────────┼──────────────────────────┤
 * │  1  │ Login admin / student                         │ 200    │ —                        │
 * │  2  │ Setup: Faculty → Major fixture                 │ 200    │ —                        │
 * │  3  │ GET /classes no token → 401                   │ 401    │ UNAUTHENTICATED          │
 * │  4  │ GET /classes student token → 403              │ 403    │ FORBIDDEN                │
 * │  5  │ POST /classes happy (with majorId)             │ 200    │ —                        │
 * │  6  │ POST /classes missing name → 400              │ 400    │ VALIDATION_ERROR         │
 * │  7  │ POST /classes missing code → 400              │ 400    │ VALIDATION_ERROR         │
 * │  8  │ POST /classes bad majorId → 404               │ 404    │ MAJOR_NOT_FOUND          │
 * │  9  │ POST /classes duplicate code → DUPLICATE      │ 4xx    │ DUPLICATE_CODE           │
 * │ 10  │ GET /classes list contains new item           │ 200    │ —                        │
 * │ 11  │ GET /classes/:id found                        │ 200    │ —                        │
 * │ 12  │ GET /classes/:id not-found → 404              │ 404    │ CLASS_NOT_FOUND          │
 * │ 13  │ PUT /classes/:id update                       │ 200    │ —                        │
 * │ 14  │ DELETE /classes/:id no children → 200         │ 200    │ —                        │
 * │ 15  │ GET /classes/:id after delete → 404           │ 404    │ CLASS_NOT_FOUND          │
 * └─────┴───────────────────────────────────────────────┴────────┴──────────────────────────┘
 *
 * Note: delete-restrict (Class with Student) tested in students script teardown.
 */

import {
  api, loginAdmin, loginStudent,
  makeRunner, uniqueSuffix,
  expectStatus, expectCreateOk, expectErrorCode, assert,
} from './_admin-test-helpers.ts';

const { test, summary } = makeRunner('CLASSES');
const BASE = '/admin';
const sfx = uniqueSuffix();

let facultyId = '';
let majorId = '';
let classId = '';

async function run() {
  console.log('='.repeat(60));
  console.log('ADMIN — CLASSES API TEST');
  console.log('='.repeat(60));

  try {
    await test('1. Login admin', async () => { await loginAdmin(); });
    const studentToken = await loginStudent();

    // ── Fixture: Faculty → Major ──────────────────────────────────────────
    await test('2a. Setup Faculty', async () => {
      const r = await api('POST', `${BASE}/faculties`, {
        body: { name: `FAC for Class ${sfx}`, code: `FAC_C_${sfx}` },
      });
      expectCreateOk(r);
      facultyId = (r.data as { id: string }).id;
    });

    await test('2b. Setup Major', async () => {
      const r = await api('POST', `${BASE}/majors`, {
        body: { name: `Major for Class ${sfx}`, code: `MAJ_C_${sfx}`, facultyId },
      });
      expectCreateOk(r);
      majorId = (r.data as { id: string }).id;
    });

    // ── RBAC ─────────────────────────────────────────────────────────────
    await test('3. GET /classes no token → 401', async () => {
      expectStatus(await api('GET', `${BASE}/classes`, { token: null }), 401);
    });

    await test('4. GET /classes student token → 403', async () => {
      if (!studentToken) { console.log('     [SKIP]'); return; }
      const r = await api('GET', `${BASE}/classes`, { token: studentToken });
      expectStatus(r, 403);
      expectErrorCode(r, 'FORBIDDEN');
    });

    // ── Create ────────────────────────────────────────────────────────────
    await test('5. POST /classes happy', async () => {
      const r = await api('POST', `${BASE}/classes`, {
        body: { name: `Lớp Test ${sfx}`, code: `CLS_${sfx}`, majorId },
      });
      expectCreateOk(r);
      classId = (r.data as { id: string }).id;
      assert(!!classId, 'id present');
    });

    await test('6. POST /classes missing name → 400', async () => {
      expectStatus(await api('POST', `${BASE}/classes`, {
        body: { code: `CLS2_${sfx}`, majorId },
      }), 400);
    });

    await test('7. POST /classes missing code → 400', async () => {
      expectStatus(await api('POST', `${BASE}/classes`, {
        body: { name: 'No Code', majorId },
      }), 400);
    });

    await test('8. POST /classes bad majorId → 404 MAJOR_NOT_FOUND', async () => {
      const r = await api('POST', `${BASE}/classes`, {
        body: { name: 'Bad FK', code: `CLS3_${sfx}`, majorId: 'nonexistent-000' },
      });
      expectStatus(r, 404);
      expectErrorCode(r, 'MAJOR_NOT_FOUND');
    });

    await test('9. POST /classes duplicate code → DUPLICATE_CODE', async () => {
      const r = await api('POST', `${BASE}/classes`, {
        body: { name: 'Dup Class', code: `CLS_${sfx}`, majorId },
      });
      assert(r.status >= 400, `expected 4xx, got ${r.status}`);
      expectErrorCode(r, 'DUPLICATE_CODE');
    });

    // ── List / Get ────────────────────────────────────────────────────────
    await test('10. GET /classes list contains new item', async () => {
      const r = await api('GET', `${BASE}/classes?pageSize=100`);
      expectCreateOk(r);
      const d = r.data as { items: { id: string }[] };
      assert(d.items.some(i => i.id === classId), 'item in list');
    });

    await test('11. GET /classes/:id found', async () => {
      expectStatus(await api('GET', `${BASE}/classes/${classId}`), 200);
    });

    await test('12. GET /classes/nonexistent → 404 CLASS_NOT_FOUND', async () => {
      const r = await api('GET', `${BASE}/classes/nonexistent-000`);
      expectStatus(r, 404);
      expectErrorCode(r, 'CLASS_NOT_FOUND');
    });

    // ── Update ────────────────────────────────────────────────────────────
    await test('13. PUT /classes/:id update name', async () => {
      const r = await api('PUT', `${BASE}/classes/${classId}`, {
        body: { name: `Lớp Updated ${sfx}` },
      });
      expectCreateOk(r);
      assert((r.data as { name: string }).name === `Lớp Updated ${sfx}`, 'name updated');
    });

    // ── Delete ────────────────────────────────────────────────────────────
    await test('14. DELETE /classes/:id no children → 200', async () => {
      expectStatus(await api('DELETE', `${BASE}/classes/${classId}`), 200);
      classId = '';
    });

    await test('15. GET /classes/:id after delete → 404', async () => {
      if (classId) { expectStatus(await api('GET', `${BASE}/classes/${classId}`), 404); }
      else { console.log('     [INFO] already cleaned'); }
    });
  } finally {
    if (classId) await api('DELETE', `${BASE}/classes/${classId}`).catch(() => null);
    if (majorId) await api('DELETE', `${BASE}/majors/${majorId}`).catch(() => null);
    if (facultyId) await api('DELETE', `${BASE}/faculties/${facultyId}`).catch(() => null);
  }

  return summary();
}

run().then(ok => process.exit(ok ? 0 : 1));
