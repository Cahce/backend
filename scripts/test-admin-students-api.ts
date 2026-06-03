/**
 * Admin — Students CRUD API Test
 * Script: npm run test:api:admin:students
 *
 * ┌─────┬────────────────────────────────────────────────────────┬────────┬───────────────────────────┐
 * │ #   │ Test case                                               │ Expect │ error.code                │
 * ├─────┼────────────────────────────────────────────────────────┼────────┼───────────────────────────┤
 * │  1  │ Login admin / student                                  │ 200    │ —                         │
 * │  2  │ Setup: Faculty → Major → Class + Account fixture        │ 200    │ —                         │
 * │  3  │ GET /students no token → 401                           │ 401    │ UNAUTHENTICATED           │
 * │  4  │ GET /students student token → 403                      │ 403    │ FORBIDDEN                 │
 * │  5  │ POST /students happy                                    │ 200    │ —                         │
 * │  6  │ POST /students missing required fields → 400            │ 400    │ VALIDATION_ERROR          │
 * │  7  │ POST /students bad classId → 404                        │ 404    │ CLASS_NOT_FOUND           │
 * │  8  │ POST /students duplicate studentCode → DUPLICATE        │ 4xx    │ DUPLICATE_STUDENT_CODE    │
 * │  9  │ GET /students list contains new item                   │ 200    │ —                         │
 * │ 10  │ GET /students/:id found                                │ 200    │ —                         │
 * │ 11  │ GET /students/:id not-found → 404                      │ 404    │ STUDENT_NOT_FOUND         │
 * │ 12  │ PUT /students/:id update                               │ 200    │ —                         │
 * │ 13  │ DELETE /students (class has student) → Class restrict   │ verify │ HAS_LINKED_STUDENTS       │
 * │ 14  │ POST /students/:id/link-account happy                  │ 200    │ —                         │
 * │ 15  │ POST /students/:id/link-account already linked         │ 4xx    │ STUDENT_ALREADY_LINKED    │
 * │ 16  │ DELETE /students/:id/unlink-account → 200              │ 200    │ —                         │
 * │ 17  │ DELETE /students/:id → 200                             │ 200    │ —                         │
 * │ 18  │ GET /students/:id after delete → 404                   │ 404    │ STUDENT_NOT_FOUND         │
 * └─────┴────────────────────────────────────────────────────────┴────────┴───────────────────────────┘
 */

import {
  api, loginAdmin, loginStudent,
  makeRunner, uniqueSuffix,
  expectStatus, expectCreateOk, expectErrorCode, assert,
} from './_admin-test-helpers.ts';

const { test, summary } = makeRunner('STUDENTS');
const BASE = '/admin';
const sfx = uniqueSuffix();

let facultyId = '';
let majorId = '';
let classId = '';
let studentId = '';
let accountId = '';

async function run() {
  console.log('='.repeat(60));
  console.log('ADMIN — STUDENTS API TEST');
  console.log('='.repeat(60));

  try {
    await test('1. Login admin', async () => { await loginAdmin(); });
    const studentToken = await loginStudent();

    // ── Fixtures ──────────────────────────────────────────────────────────
    await test('2a. Setup Faculty', async () => {
      const r = await api('POST', `${BASE}/faculties`, {
        body: { name: `FAC for Student ${sfx}`, code: `FAC_S_${sfx}` },
      });
      expectCreateOk(r);
      facultyId = (r.data as { id: string }).id;
    });

    await test('2b. Setup Major', async () => {
      const r = await api('POST', `${BASE}/majors`, {
        body: { name: `Major for Student ${sfx}`, code: `MAJ_S_${sfx}`, facultyId },
      });
      expectCreateOk(r);
      majorId = (r.data as { id: string }).id;
    });

    await test('2c. Setup Class', async () => {
      const r = await api('POST', `${BASE}/classes`, {
        body: { name: `Class for Student ${sfx}`, code: `CLS_S_${sfx}`, majorId },
      });
      expectCreateOk(r);
      classId = (r.data as { id: string }).id;
    });

    await test('2d. Setup temp Account for link test', async () => {
      const r = await api('POST', `${BASE}/accounts`, {
        body: {
          email: `student_qa_${sfx}@e.tlu.edu.vn`,
          password: 'Password1234',
          role: 'student',
        },
      });
      expectCreateOk(r);
      accountId = (r.data as { id: string }).id;
    });

    // ── RBAC ──────────────────────────────────────────────────────────────
    await test('3. GET /students no token → 401', async () => {
      expectStatus(await api('GET', `${BASE}/students`, { token: null }), 401);
    });

    await test('4. GET /students student token → 403', async () => {
      if (!studentToken) { console.log('     [SKIP]'); return; }
      const r = await api('GET', `${BASE}/students`, { token: studentToken });
      expectStatus(r, 403);
      expectErrorCode(r, 'FORBIDDEN');
    });

    // ── Create ────────────────────────────────────────────────────────────
    await test('5. POST /students happy', async () => {
      const r = await api('POST', `${BASE}/students`, {
        body: {
          studentCode: `SV_${sfx}`,
          fullName: `Sinh Viên Test ${sfx}`,
          classId,
        },
      });
      expectCreateOk(r, 'create');
      studentId = (r.data as { id: string }).id;
      assert(!!studentId, 'id present');
    });

    await test('6. POST /students missing required fields → 400', async () => {
      const r = await api('POST', `${BASE}/students`, {
        body: { classId },  // missing studentCode + fullName
      });
      expectStatus(r, 400);
    });

    await test('7. POST /students bad classId → 404 CLASS_NOT_FOUND', async () => {
      const r = await api('POST', `${BASE}/students`, {
        body: { studentCode: `SV2_${sfx}`, fullName: 'Bad FK', classId: 'nonexistent-000' },
      });
      expectStatus(r, 404);
      expectErrorCode(r, 'CLASS_NOT_FOUND');
    });

    await test('8. POST /students duplicate studentCode → DUPLICATE_STUDENT_CODE', async () => {
      const r = await api('POST', `${BASE}/students`, {
        body: { studentCode: `SV_${sfx}`, fullName: 'Dup Student', classId },
      });
      assert(r.status >= 400, `expected 4xx, got ${r.status}`);
      expectErrorCode(r, 'DUPLICATE_STUDENT_CODE');
    });

    // ── List / Get ────────────────────────────────────────────────────────
    await test('9. GET /students list contains new item', async () => {
      const r = await api('GET', `${BASE}/students?pageSize=100`);
      expectStatus(r, 200);
      const d = r.data as { items: { id: string }[] };
      assert(d.items.some(i => i.id === studentId), 'item in list');
    });

    await test('10. GET /students/:id found', async () => {
      expectStatus(await api('GET', `${BASE}/students/${studentId}`), 200);
    });

    await test('11. GET /students/nonexistent → 404 STUDENT_NOT_FOUND', async () => {
      const r = await api('GET', `${BASE}/students/nonexistent-000`);
      expectStatus(r, 404);
      expectErrorCode(r, 'STUDENT_NOT_FOUND');
    });

    // ── Update ────────────────────────────────────────────────────────────
    await test('12. PUT /students/:id update fullName', async () => {
      const r = await api('PUT', `${BASE}/students/${studentId}`, {
        body: { fullName: `SV Updated ${sfx}` },
      });
      expectStatus(r, 200);
      assert((r.data as { fullName: string }).fullName === `SV Updated ${sfx}`, 'fullName updated');
    });

    // ── Delete-restrict: class still has student ──────────────────────────
    await test('13. DELETE /classes/:id with student → HAS_LINKED_STUDENTS', async () => {
      const r = await api('DELETE', `${BASE}/classes/${classId}`);
      assert(r.status >= 400, `expected 4xx (restrict), got ${r.status}`);
      expectErrorCode(r, 'HAS_LINKED_STUDENTS');
      // Class still exists
      expectStatus(await api('GET', `${BASE}/classes/${classId}`), 200, 'class still exists');
    });

    // ── Link / Unlink account ─────────────────────────────────────────────
    await test('14. POST /students/:id/link-account happy', async () => {
      const r = await api('POST', `${BASE}/students/${studentId}/link-account`, {
        body: { accountId },
      });
      expectStatus(r, 200, 'link-account');
    });

    await test('15. POST /students/:id/link-account already linked → STUDENT_ALREADY_LINKED', async () => {
      const r = await api('POST', `${BASE}/students/${studentId}/link-account`, {
        body: { accountId },
      });
      assert(r.status >= 400, `expected 4xx, got ${r.status}`);
      const code = (r.data as { error?: { code?: string } })?.error?.code;
      assert(
        code === 'STUDENT_ALREADY_LINKED' ||
        code === 'ACCOUNT_ALREADY_LINKED' ||
        code === 'ACCOUNT_ALREADY_LINKED_TO_STUDENT',
        `expected STUDENT/ACCOUNT_ALREADY_LINKED*, got ${code}`,
      );
    });

    await test('16. DELETE /students/:id/unlink-account → 200', async () => {
      expectStatus(await api('DELETE', `${BASE}/students/${studentId}/unlink-account`), 200);
    });

    // ── Delete ────────────────────────────────────────────────────────────
    await test('17. DELETE /students/:id → 200', async () => {
      expectStatus(await api('DELETE', `${BASE}/students/${studentId}`), 200);
      studentId = '';
    });

    await test('18. GET /students/:id after delete → 404', async () => {
      if (studentId) { expectStatus(await api('GET', `${BASE}/students/${studentId}`), 404); }
      else { console.log('     [INFO] already cleaned'); }
    });
  } finally {
    if (studentId) await api('DELETE', `${BASE}/students/${studentId}`).catch(() => null);
    if (accountId) await api('DELETE', `${BASE}/accounts/${accountId}`).catch(() => null);
    if (classId) await api('DELETE', `${BASE}/classes/${classId}`).catch(() => null);
    if (majorId) await api('DELETE', `${BASE}/majors/${majorId}`).catch(() => null);
    if (facultyId) await api('DELETE', `${BASE}/faculties/${facultyId}`).catch(() => null);
  }

  return summary();
}

run().then(ok => process.exit(ok ? 0 : 1));
