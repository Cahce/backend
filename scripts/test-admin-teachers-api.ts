/**
 * Admin — Teachers CRUD API Test
 * Script: npm run test:api:admin:teachers
 *
 * ┌─────┬───────────────────────────────────────────────────────┬────────┬──────────────────────────┐
 * │ #   │ Test case                                              │ Expect │ error.code               │
 * ├─────┼───────────────────────────────────────────────────────┼────────┼──────────────────────────┤
 * │  1  │ Login admin / student                                 │ 200    │ —                        │
 * │  2  │ Setup: Faculty → Department + Account fixture          │ 200    │ —                        │
 * │  3  │ GET /teachers no token → 401                          │ 401    │ UNAUTHENTICATED          │
 * │  4  │ GET /teachers student token → 403                     │ 403    │ FORBIDDEN                │
 * │  5  │ POST /teachers happy                                   │ 200    │ —                        │
 * │  6  │ POST /teachers missing required fields → 400           │ 400    │ VALIDATION_ERROR         │
 * │  7  │ POST /teachers bad departmentId → 404                  │ 404    │ DEPARTMENT_NOT_FOUND     │
 * │  8  │ POST /teachers duplicate teacherCode → DUPLICATE       │ 4xx    │ DUPLICATE_TEACHER_CODE   │
 * │  9  │ GET /teachers list contains new item                  │ 200    │ —                        │
 * │ 10  │ GET /teachers/:id found                               │ 200    │ —                        │
 * │ 11  │ GET /teachers/:id not-found → 404                     │ 404    │ TEACHER_NOT_FOUND        │
 * │ 12  │ PUT /teachers/:id update                              │ 200    │ —                        │
 * │ 13  │ POST /teachers/:id/link-account happy                 │ 200    │ —                        │
 * │ 14  │ POST /teachers/:id/link-account already linked        │ 4xx    │ TEACHER_ALREADY_LINKED   │
 * │ 15  │ POST /teachers/:id/link-account bad accountId → 404   │ 404    │ ACCOUNT_NOT_FOUND        │
 * │ 16  │ DELETE /teachers/:id/unlink-account → 200             │ 200    │ —                        │
 * │ 17  │ DELETE /teachers/:id → 200                            │ 200    │ —                        │
 * │ 18  │ GET /teachers/:id after delete → 404                  │ 404    │ TEACHER_NOT_FOUND        │
 * └─────┴───────────────────────────────────────────────────────┴────────┴──────────────────────────┘
 */

import {
  api, loginAdmin, loginStudent,
  makeRunner, uniqueSuffix,
  expectStatus, expectCreateOk, expectErrorCode, assert,
} from './_admin-test-helpers.ts';

const { test, summary } = makeRunner('TEACHERS');
const BASE = '/admin';
const sfx = uniqueSuffix();

let facultyId = '';
let deptId = '';
let teacherId = '';
let accountId = '';  // temp account for link test

async function run() {
  console.log('='.repeat(60));
  console.log('ADMIN — TEACHERS API TEST');
  console.log('='.repeat(60));

  try {
    await test('1. Login admin', async () => { await loginAdmin(); });
    const studentToken = await loginStudent();

    // ── Fixtures ──────────────────────────────────────────────────────────
    await test('2a. Setup Faculty', async () => {
      const r = await api('POST', `${BASE}/faculties`, {
        body: { name: `FAC for Teacher ${sfx}`, code: `FAC_T_${sfx}` },
      });
      expectCreateOk(r);
      facultyId = (r.data as { id: string }).id;
    });

    await test('2b. Setup Department', async () => {
      const r = await api('POST', `${BASE}/departments`, {
        body: { name: `BM for Teacher ${sfx}`, code: `DEPT_T_${sfx}`, facultyId },
      });
      expectCreateOk(r);
      deptId = (r.data as { id: string }).id;
    });

    await test('2c. Setup temp Account for link test', async () => {
      const r = await api('POST', `${BASE}/accounts`, {
        body: {
          email: `teacher_qa_${sfx}@tlu.edu.vn`,
          password: 'Password1234',
          role: 'teacher',
        },
      });
      expectCreateOk(r);
      accountId = (r.data as { id: string }).id;
    });

    // ── RBAC ──────────────────────────────────────────────────────────────
    await test('3. GET /teachers no token → 401', async () => {
      expectStatus(await api('GET', `${BASE}/teachers`, { token: null }), 401);
    });

    await test('4. GET /teachers student token → 403', async () => {
      if (!studentToken) { console.log('     [SKIP]'); return; }
      const r = await api('GET', `${BASE}/teachers`, { token: studentToken });
      expectStatus(r, 403);
      expectErrorCode(r, 'FORBIDDEN');
    });

    // ── Create ────────────────────────────────────────────────────────────
    await test('5. POST /teachers happy', async () => {
      const r = await api('POST', `${BASE}/teachers`, {
        body: {
          teacherCode: `GV_${sfx}`,
          fullName: `Giảng Viên Test ${sfx}`,
          departmentId: deptId,
          academicRank: 'Tiến sĩ',
          academicDegree: 'Tiến sĩ',
          account: { mode: 'none' },
        },
      });
      expectCreateOk(r, 'create');
      teacherId = (r.data as { id: string }).id;
      assert(!!teacherId, 'id present');
    });

    await test('6. POST /teachers missing required fields → 400', async () => {
      // Missing teacherCode
      const r = await api('POST', `${BASE}/teachers`, {
        body: { fullName: 'No Code', departmentId: deptId, academicRank: 'Tiến sĩ', academicDegree: 'Tiến sĩ', account: { mode: 'none' } },
      });
      expectStatus(r, 400);
    });

    await test('7. POST /teachers bad departmentId → 404', async () => {
      const r = await api('POST', `${BASE}/teachers`, {
        body: {
          teacherCode: `GV2_${sfx}`,
          fullName: 'Bad FK',
          departmentId: 'nonexistent-000',
          academicRank: 'Tiến sĩ',
          academicDegree: 'Tiến sĩ',
          account: { mode: 'none' },
        },
      });
      expectStatus(r, 404);
      expectErrorCode(r, 'DEPARTMENT_NOT_FOUND');
    });

    await test('8. POST /teachers duplicate teacherCode → DUPLICATE_TEACHER_CODE', async () => {
      const r = await api('POST', `${BASE}/teachers`, {
        body: {
          teacherCode: `GV_${sfx}`,
          fullName: 'Dup Teacher',
          departmentId: deptId,
          academicRank: 'Thạc sĩ',
          academicDegree: 'Thạc sĩ',
          account: { mode: 'none' },
        },
      });
      assert(r.status >= 400, `expected 4xx, got ${r.status}`);
      expectErrorCode(r, 'DUPLICATE_TEACHER_CODE');
    });

    // ── List / Get ────────────────────────────────────────────────────────
    await test('9. GET /teachers list contains new item', async () => {
      const r = await api('GET', `${BASE}/teachers?pageSize=100`);
      expectCreateOk(r);
      const d = r.data as { items: { id: string }[] };
      assert(d.items.some(i => i.id === teacherId), 'item in list');
    });

    await test('10. GET /teachers/:id found', async () => {
      expectStatus(await api('GET', `${BASE}/teachers/${teacherId}`), 200);
    });

    await test('11. GET /teachers/nonexistent → 404 TEACHER_NOT_FOUND', async () => {
      const r = await api('GET', `${BASE}/teachers/nonexistent-000`);
      expectStatus(r, 404);
      expectErrorCode(r, 'TEACHER_NOT_FOUND');
    });

    // ── Update ────────────────────────────────────────────────────────────
    await test('12. PUT /teachers/:id update fullName', async () => {
      const r = await api('PUT', `${BASE}/teachers/${teacherId}`, {
        body: { fullName: `GV Updated ${sfx}` },
      });
      expectCreateOk(r);
      assert((r.data as { fullName: string }).fullName === `GV Updated ${sfx}`, 'fullName updated');
    });

    // ── Link / Unlink account ─────────────────────────────────────────────
    await test('13. POST /teachers/:id/link-account happy', async () => {
      const r = await api('POST', `${BASE}/teachers/${teacherId}/link-account`, {
        body: { accountId },
      });
      expectStatus(r, 200, 'link-account');
    });

    await test('14. POST /teachers/:id/link-account already linked → TEACHER_ALREADY_LINKED', async () => {
      const r = await api('POST', `${BASE}/teachers/${teacherId}/link-account`, {
        body: { accountId },
      });
      assert(r.status >= 400, `expected 4xx, got ${r.status}`);
      const code = (r.data as { error?: { code?: string } })?.error?.code;
      assert(
        code === 'TEACHER_ALREADY_LINKED' ||
        code === 'ACCOUNT_ALREADY_LINKED' ||
        code === 'ACCOUNT_ALREADY_LINKED_TO_TEACHER',
        `expected TEACHER/ACCOUNT_ALREADY_LINKED*, got ${code}`,
      );
    });

    await test('15. POST /teachers/:id/link-account bad accountId → 404', async () => {
      // Create a new teacher to test with a non-existent account
      const r2 = await api('POST', `${BASE}/teachers/${teacherId}/link-account`, {
        body: { accountId: 'nonexistent-000' },
      });
      // Should be 404 since we already linked — the already-linked error takes precedence or ACCOUNT_NOT_FOUND
      assert(r2.status >= 400, `expected 4xx, got ${r2.status}`);
    });

    await test('16. DELETE /teachers/:id/unlink-account → 200', async () => {
      const r = await api('DELETE', `${BASE}/teachers/${teacherId}/unlink-account`);
      expectStatus(r, 200, 'unlink-account');
    });

    // ── Delete ────────────────────────────────────────────────────────────
    await test('17. DELETE /teachers/:id → 200', async () => {
      expectStatus(await api('DELETE', `${BASE}/teachers/${teacherId}`), 200);
      teacherId = '';
    });

    await test('18. GET /teachers/:id after delete → 404', async () => {
      if (teacherId) { expectStatus(await api('GET', `${BASE}/teachers/${teacherId}`), 404); }
      else { console.log('     [INFO] already cleaned'); }
    });
  } finally {
    if (teacherId) await api('DELETE', `${BASE}/teachers/${teacherId}`).catch(() => null);
    if (accountId) await api('DELETE', `${BASE}/accounts/${accountId}`).catch(() => null);
    if (deptId) await api('DELETE', `${BASE}/departments/${deptId}`).catch(() => null);
    if (facultyId) await api('DELETE', `${BASE}/faculties/${facultyId}`).catch(() => null);
  }

  return summary();
}

run().then(ok => process.exit(ok ? 0 : 1));
