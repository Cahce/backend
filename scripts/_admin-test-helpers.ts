
export const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
export const API = `${BASE_URL}/api/v1`;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@tlu.edu.vn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '123456';
const STUDENT_EMAIL = process.env.STUDENT_EMAIL ?? '2251172560@e.tlu.edu.vn';
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD ?? '123456';


interface TestResult { name: string; passed: boolean; message?: string }

export function makeRunner(label: string) {
  const results: TestResult[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`  ✓ ${name}`);
    } catch (err) {
      results.push({ name, passed: false, message: String(err) });
      console.log(`  ✗ ${name}`);
      console.log(`      ${err}`);
    }
  }

  function summary(): boolean {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    console.log('');
    console.log('─'.repeat(60));
    console.log(`${label}: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
      results.filter(r => !r.passed).forEach(r =>
        console.log(`  FAIL: ${r.name} — ${r.message}`)
      );
    }
    return failed === 0;
  }

  return { test, summary };
}


export interface ApiResponse { status: number; data: unknown }

export async function api(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string | null } = {},
): Promise<ApiResponse> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (opts.token !== null) {
    const tok = opts.token ?? _state.adminToken;
    if (tok) headers['Authorization'] = `Bearer ${tok}`;
  }

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { _binary: true, raw: text.slice(0, 20) };
  }
  return { status: res.status, data };
}


const _state = { adminToken: '', studentToken: '' };

export async function loginAdmin(): Promise<string> {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const d = await r.json() as { accessToken?: string };
  if (!d.accessToken) throw new Error(`Admin login failed (${r.status})`);
  _state.adminToken = d.accessToken;
  return _state.adminToken;
}

export async function loginStudent(): Promise<string | null> {
  try {
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD }),
    });
    const d = await r.json() as { accessToken?: string };
    _state.studentToken = d.accessToken ?? '';
    return _state.studentToken || null;
  } catch {
    return null;
  }
}

export function getStudentToken(): string { return _state.studentToken; }


export function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`Assert failed: ${msg}`);
}

export function expectStatus(res: ApiResponse, want: number, ctx = ''): void {
  if (res.status !== want) {
    throw new Error(
      `${ctx ? ctx + ': ' : ''}expected ${want}, got ${res.status} — ${JSON.stringify(res.data)}`,
    );
  }
}

export function expectCreateOk(res: ApiResponse, ctx = ''): void {
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `${ctx ? ctx + ': ' : ''}expected 200|201 (create), got ${res.status} — ${JSON.stringify(res.data)}`,
    );
  }
}

export function expectErrorCode(res: ApiResponse, code: string, ctx = ''): void {
  const got = (res.data as { error?: { code?: string } })?.error?.code;
  if (got !== code) {
    throw new Error(
      `${ctx ? ctx + ': ' : ''}expected error.code="${code}", got "${got}" — ${JSON.stringify(res.data)}`,
    );
  }
}


export function uniqueSuffix(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}
