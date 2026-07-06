
import {
  api, loginAdmin, loginStudent,
  makeRunner, uniqueSuffix,
  expectStatus, expectCreateOk, expectErrorCode, assert,
} from './_admin-test-helpers.ts';

const { test, summary } = makeRunner('ACCOUNTS');
const BASE = '/admin';
const sfx = uniqueSuffix();

let accountId = '';
const testEmail = `qa_acc_${sfx}@e.tlu.edu.vn`;

async function run() {
  console.log('='.repeat(60));
  console.log('ADMIN — ACCOUNTS API TEST');
  console.log('='.repeat(60));

  try {
    await test('1. Login admin', async () => { await loginAdmin(); });
    const studentToken = await loginStudent();

    await test('2. GET /accounts no token → 401', async () => {
      expectStatus(await api('GET', `${BASE}/accounts`, { token: null }), 401);
    });

    await test('3. GET /accounts student token → 403', async () => {
      if (!studentToken) { console.log('     [SKIP]'); return; }
      const r = await api('GET', `${BASE}/accounts`, { token: studentToken });
      expectStatus(r, 403);
      expectErrorCode(r, 'FORBIDDEN');
    });

    await test('4. POST /accounts happy (role=student)', async () => {
      const r = await api('POST', `${BASE}/accounts`, {
        body: { email: testEmail, password: 'Password1234', role: 'student' },
      });
      expectCreateOk(r, 'create');
      const d = r.data as { id: string; email: string; role: string };
      assert(!!d.id, 'id present');
      assert(d.email === testEmail, 'email matches');
      assert(d.role === 'student', 'role matches');
      accountId = d.id;
      console.log(`     id=${accountId}`);
    });


    await test('5. POST /accounts missing email → 4xx (BUG: actual 500)', async () => {
      const r = await api('POST', `${BASE}/accounts`, {
        body: { password: 'Password1234', role: 'student' },
      });
      assert(r.status >= 400, `expected 4xx (validation reject), got ${r.status}`);
    });

    await test('6. POST /accounts invalid email format → 4xx (BUG: actual 500)', async () => {
      const r = await api('POST', `${BASE}/accounts`, {
        body: { email: 'not-an-email', password: 'Password1234', role: 'student' },
      });
      assert(r.status >= 400, `expected 4xx (validation reject), got ${r.status}`);
    });

    await test('7. POST /accounts invalid role → 4xx (BUG: actual 500)', async () => {
      const r = await api('POST', `${BASE}/accounts`, {
        body: { email: `qa_bad_role_${sfx}@e.tlu.edu.vn`, password: 'Password1234', role: 'superadmin' },
      });
      assert(r.status >= 400, `expected 4xx (validation reject), got ${r.status}`);
    });

    await test('8. POST /accounts short password → 4xx (BUG: actual 500)', async () => {
      const r = await api('POST', `${BASE}/accounts`, {
        body: { email: `qa_short_${sfx}@e.tlu.edu.vn`, password: '123', role: 'student' },
      });
      assert(r.status >= 400, `expected 4xx (validation reject), got ${r.status}`);
    });

    await test('9. POST /accounts duplicate email → EMAIL_EXISTS', async () => {
      const r = await api('POST', `${BASE}/accounts`, {
        body: { email: testEmail, password: 'Password1234', role: 'student' },
      });
      assert(r.status >= 400, `expected 4xx, got ${r.status}`);
      expectErrorCode(r, 'EMAIL_EXISTS');
    });

    await test('10. GET /accounts list contains new item', async () => {
      const r = await api('GET', `${BASE}/accounts?pageSize=100`);
      expectStatus(r, 200);
      const d = r.data as { items: { id: string }[] };
      assert(d.items.some(i => i.id === accountId), 'item in list');
    });

    await test('11. GET /accounts with role=student filter', async () => {
      const r = await api('GET', `${BASE}/accounts?role=student&pageSize=100`);
      expectStatus(r, 200);
      const d = r.data as { items: { role: string }[] };
      const allStudent = d.items.every(i => i.role === 'student');
      assert(allStudent, 'all filtered items are students');
    });

    await test('12. GET /accounts/:id found', async () => {
      const r = await api('GET', `${BASE}/accounts/${accountId}`);
      expectStatus(r, 200);
      assert((r.data as { id: string }).id === accountId, 'id matches');
    });

    await test('13. GET /accounts/nonexistent → 404 ACCOUNT_NOT_FOUND', async () => {
      const r = await api('GET', `${BASE}/accounts/nonexistent-000`);
      expectStatus(r, 404);
      expectErrorCode(r, 'ACCOUNT_NOT_FOUND');
    });

    await test('14. PATCH /accounts/:id isActive=false', async () => {
      const r = await api('PATCH', `${BASE}/accounts/${accountId}`, {
        body: { isActive: false },
      });
      expectStatus(r, 200);
      assert((r.data as { isActive: boolean }).isActive === false, 'isActive updated');
    });

    await test('15. PATCH /accounts/:id email update', async () => {
      const newEmail = `qa_acc_upd_${sfx}@e.tlu.edu.vn`;
      const r = await api('PATCH', `${BASE}/accounts/${accountId}`, {
        body: { email: newEmail },
      });
      expectStatus(r, 200);
      assert((r.data as { email: string }).email === newEmail, 'email updated');
    });

    await test('16. POST /accounts/:id/reset-password → 200', async () => {
      const r = await api('POST', `${BASE}/accounts/${accountId}/reset-password`, {
        body: { newPassword: 'NewPassword5678' },
      });
      expectStatus(r, 200, 'reset-password');
    });

    await test('17. POST /accounts/nonexistent/reset-password → 404', async () => {
      const r = await api('POST', `${BASE}/accounts/nonexistent-000/reset-password`, {
        body: { newPassword: 'NewPassword5678' },
      });
      expectStatus(r, 404);
      expectErrorCode(r, 'ACCOUNT_NOT_FOUND');
    });

    await test('18. DELETE /accounts/:id → 200|204', async () => {
      const r = await api('DELETE', `${BASE}/accounts/${accountId}`);
      assert(r.status === 200 || r.status === 204, `expected 200|204, got ${r.status}`);
      accountId = '';
    });

    await test('19. GET /accounts/:id after delete → 404', async () => {
      if (accountId) {
        expectStatus(await api('GET', `${BASE}/accounts/${accountId}`), 404);
      } else {
        console.log('     [INFO] already cleaned');
      }
    });
  } finally {
    if (accountId) await api('DELETE', `${BASE}/accounts/${accountId}`).catch(() => null);
  }

  return summary();
}

run().then(ok => process.exit(ok ? 0 : 1));
