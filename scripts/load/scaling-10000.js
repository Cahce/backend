// k6 script for the EXISTING REST/native-ws protocol. No remote JS dependencies.
// See docs/scaling-10000-users.md. This file does not provision/delete fixtures.
import http from 'k6/http';
import ws from 'k6/ws';
import encoding from 'k6/encoding';
import crypto from 'k6/crypto';
import exec from 'k6/execution';
import { sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';

function integer(name, fallback, min, max) {
  const n = Number(__ENV[name] ?? fallback);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Invalid ${name}`);
  return n;
}
const BASE = (__ENV.BASE_URL || '').replace(/\/$/, '');
if (!/^https?:\/\/[^/?#]+$/.test(BASE) || BASE.includes('@')) {
  throw new Error('BASE_URL must be an explicit origin without credentials/path');
}
if (__ENV.RUN_LOAD_TEST !== '1' || __ENV.ALLOWED_ORIGIN !== BASE) {
  throw new Error('Set RUN_LOAD_TEST=1 and ALLOWED_ORIGIN exactly equal to BASE_URL');
}
const PROFILE = __ENV.PROFILE || 'ws';
if (!['ws', 'http'].includes(PROFILE)) throw new Error('PROFILE must be ws or http');
const USERS = integer('USERS', 50, 1, 10000);
const OFFSET = integer('ACCOUNT_OFFSET', 0, 0, 1000000);
const RAMP = integer('RAMP_SECONDS', 10, 0, 3600);
const HOLD = integer('HOLD_SECONDS', 60, 10, 14400);
const ACTIVE_PERCENT = integer('ACTIVE_PERCENT', 0, 0, 100);
const POLL_MS = integer('ACCESS_POLL_MS', 2000, 0, 60000);
const SAVE_MS = integer('SAVE_MS', 10000, 1000, 600000);
const CHAT_MS = integer('CHAT_MS', 30000, 1000, 600000);
const RPS = integer('RPS', 20, 1, 50000);
const OP = __ENV.OP || 'access';
const OPERATIONS = ['access', 'project', 'files', 'chat-history', 'templates', 'save', 'chat', 'compile'];
if (!OPERATIONS.includes(OP)) throw new Error('Unsupported OP');
const ACCOUNT_INTERVAL_MS = integer('ACCOUNT_INTERVAL_MS', OP === 'compile' ? 11000 : 1000, 0, 600000);
const WRITES = PROFILE === 'ws' ? ACTIVE_PERCENT > 0 : ['save', 'chat', 'compile'].includes(OP);
if (WRITES && __ENV.ALLOW_WRITES !== '1') throw new Error('Fixture writes require ALLOW_WRITES=1');
if ((USERS > 200 || RPS > 500) && __ENV.CONFIRM_LARGE_LOAD !== '1') {
  throw new Error('Large load requires CONFIRM_LARGE_LOAD=1 after staging capacity checks');
}
if (PROFILE === 'ws' && !__ENV.WS_ORIGIN) throw new Error('WS_ORIGIN must match backend allowed origin');
if (!__ENV.CREDENTIALS_FILE) throw new Error('CREDENTIALS_FILE is required (outside Git)');
const accounts = new SharedArray('capacity-fixtures', () => {
  const rows = JSON.parse(open(__ENV.CREDENTIALS_FILE));
  if (!Array.isArray(rows)) throw new Error('Fixture must be an array');
  const emails = new Set(), files = new Set();
  for (const row of rows) {
    if (!row.email || !row.password || !row.projectId || emails.has(row.email)) {
      throw new Error('Fixture requires distinct accounts and projectId');
    }
    emails.add(row.email);
    if (WRITES && (!row.filePath || files.has(`${row.projectId}/${row.filePath}`))) {
      throw new Error('Each writer needs a distinct disposable filePath');
    }
    if (row.filePath) files.add(`${row.projectId}/${row.filePath}`);
    if (row.since !== undefined && !/^(0|[1-9]\d{0,18})$/.test(row.since)) {
      throw new Error('since must be a decimal sequence string');
    }
  }
  return rows;
});
if (accounts.length < OFFSET + USERS) throw new Error('Not enough unique fixture accounts');

const apiErrors = new Rate('api_unexpected_error');
const latency = new Trend('api_duration', true);
const authenticated = new Rate('ws_authenticated');
const readyCount = new Counter('ws_ready_sessions');
const connectedMs = new Counter('ws_authenticated_ms');
const closeErrors = new Counter('ws_unexpected_close');
const cursorErrors = new Counter('ws_cursor_regression');
const protocolErrors = new Counter('ws_protocol_error');
const skipped = new Counter('scheduled_actions_skipped');
const echoMissing = new Counter('own_chat_echo_missing');
const echoLatency = new Trend('own_chat_echo_ms', true);
const threshold = {
  api_unexpected_error: ['rate<0.001', { threshold: 'rate<0.02', abortOnFail: true, delayAbortEval: '60s' }],
};
if (PROFILE === 'ws') Object.assign(threshold, {
  ws_authenticated: ['rate==1'], ws_unexpected_close: ['count==0'],
  ws_cursor_regression: ['count==0'], ws_protocol_error: ['count==0'],
  scheduled_actions_skipped: ['count==0'], own_chat_echo_missing: ['count==0'],
});
else {
  threshold.dropped_iterations = ['count==0'];
  threshold[`api_duration{op:${OP}}`] = ['p(95)<300', 'p(99)<1000'];
}
export const options = {
  scenarios: PROFILE === 'ws' ? {
    connections: { executor: 'per-vu-iterations', vus: USERS, iterations: 1,
      maxDuration: `${RAMP + HOLD + 120}s`, exec: 'connections' },
  } : {
    benchmark: { executor: 'constant-arrival-rate', rate: RPS, timeUnit: '1s',
      duration: `${HOLD}s`, preAllocatedVUs: USERS, maxVUs: USERS, exec: 'benchmark' },
  },
  thresholds: threshold,
  // Omit url/error tags: no project IDs or server-provided sensitive text in metrics.
  systemTags: ['status', 'method', 'name', 'scenario', 'expected_response'],
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
};

let context;
function json(response) { try { return response.json(); } catch { return null; } }
function request(method, path, body, op, statuses = [200], token) {
  const response = http.request(method, `${BASE}/api/v1${path}`,
    body === undefined ? null : JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      timeout: '10s', redirects: 0, tags: { name: op },
    });
  apiErrors.add(!statuses.includes(response.status), { op });
  latency.add(response.timings.duration, { op });
  return response;
}
function applyTokens(c, response) {
  const data = json(response);
  if (response.status !== 200 || !data?.accessToken || !data?.refreshToken) {
    exec.test.abort('Fixture authentication/refresh failed; response intentionally not logged');
  }
  c.token = data.accessToken; c.refreshToken = data.refreshToken;
  const payload = JSON.parse(encoding.b64decode(c.token.split('.')[1], 'rawurl', 's'));
  c.refreshAt = Number(payload.exp) * 1000 - 30000;
  if (!Number.isFinite(c.refreshAt) || c.refreshAt <= Date.now()) exec.test.abort('JWT expiry too short');
}
function getContext() {
  if (!context) {
    const row = accounts[OFFSET + exec.vu.idInTest - 1];
    if (!row) exec.test.abort('No fixture for this global VU ID; check shard mapping');
    context = { row, project: `/projects/${encodeURIComponent(row.projectId)}`,
      cursor: row.since || '0', file: null, pending: new Map() };
    applyTokens(context, request('POST', '/auth/login', { email: row.email, password: row.password }, 'login'));
  }
  if (Date.now() >= context.refreshAt) {
    applyTokens(context, request('POST', '/auth/refresh', { refreshToken: context.refreshToken }, 'refresh'));
  }
  return context;
}
function filePath(c) {
  return `${c.project}/files/${c.row.filePath.split('/').map(encodeURIComponent).join('/')}`;
}
function uuid() {
  const bytes = new Uint8Array(crypto.randomBytes(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const s = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
function action(c, op, trackEcho = false) {
  if (op === 'save') {
    if (!c.file) {
      const read = request('GET', filePath(c), undefined, 'file-bootstrap', [200], c.token);
      c.file = read.status === 200 ? json(read) : null;
      if (!c.file?.id || !c.file?.revision || typeof c.file.content !== 'string') {
        exec.test.abort('Writer fixture must reference a readable text file');
      }
      if (c.original === undefined) c.original = c.file.content;
    }
    const response = request('PUT', filePath(c), {
      fileId: c.file.id, baseRevision: c.file.revision,
      content: `${c.original}\n// capacity test ${Date.now()}\n`,
    }, op, [200], c.token);
    if (response.status === 200) c.file = json(response);
    else c.file = null; // Record conflict/error; refresh on next save, never blind overwrite.
    return;
  }
  if (op === 'chat') {
    const id = uuid(), sentAt = Date.now();
    const response = request('POST', `${c.project}/chat/messages`, {
      clientMessageId: id, body: `capacity ${id}`,
    }, op, [200, 201], c.token);
    if (trackEcho && [200, 201].includes(response.status)) {
      c.pending.set(id, sentAt);
      if (c.pending.size > 1000) exec.test.abort('More than 1000 unacknowledged chat echoes for one VU');
    }
    return;
  }
  if (op === 'compile') {
    request('POST', `${c.project}/compile`, { engine: 'node', format: 'pdf' }, op, [202], c.token);
    return; // Admission benchmark only. Artifact completion is a separate gate.
  }
  const paths = { access: `${c.project}/access`, project: c.project,
    files: `${c.project}/files`, 'chat-history': `${c.project}/chat/messages?limit=50`, templates: '/templates' };
  request('GET', paths[op], undefined, op, [200], c.token);
}
export function benchmark() {
  const c = getContext();
  // Fast responses can cause the arrival-rate executor to reuse only a few VUs.
  // Explicit account pacing prevents the benchmark from merely hitting quotas.
  const waitMs = Math.max(0, (c.nextBenchmarkAt || 0) - Date.now());
  if (waitMs) { sleep(waitMs / 1000); getContext(); }
  c.nextBenchmarkAt = Date.now() + ACCOUNT_INTERVAL_MS;
  action(c, OP);
}

function compareSequence(a, b) { return a.length === b.length ? (a < b ? -1 : a > b ? 1 : 0) : a.length - b.length; }
export function connections() {
  for (const metric of [closeErrors, cursorErrors, protocolErrors, skipped, echoMissing]) metric.add(0);
  // Stagger admission; all users share one end time so HOLD is the intended plateau.
  sleep(RAMP * (exec.vu.idInTest - 1) / USERS);
  const end = exec.scenario.startTime + (RAMP + HOLD) * 1000;
  const active = Math.floor(exec.vu.idInTest * ACTIVE_PERCENT / 100)
    > Math.floor((exec.vu.idInTest - 1) * ACTIVE_PERCENT / 100);
  let retries = 0;
  while (Date.now() < end) {
    const c = getContext();
    const ticketResponse = request('POST', `${c.project}/realtime-ticket`, {}, 'ticket', [200], c.token);
    const ticket = json(ticketResponse)?.ticket;
    if (!ticket) { authenticated.add(false); sleep(1); if (++retries > 10) break; continue; }
    const stop = Math.min(end, c.refreshAt);
    let readyAt = 0, plannedClose = false;
    const result = ws.connect(`${BASE.replace(/^http/, 'ws')}/api/v1${c.project}/realtime`,
      { headers: { Origin: __ENV.WS_ORIGIN }, tags: { name: 'realtime' } }, socket => {
        socket.on('open', () => socket.send(JSON.stringify({ type: 'authenticate', ticket, since: c.cursor })));
        socket.setTimeout(() => { if (!readyAt) socket.close(); }, 6000);
        socket.setTimeout(() => { plannedClose = true; socket.close(); }, Math.max(1, stop - Date.now()));
        socket.on('message', raw => {
          let message;
          try { message = JSON.parse(raw); } catch { protocolErrors.add(1); return; }
          if (message.type === 'ready' && !readyAt) {
            readyAt = Date.now(); readyCount.add(1);
            const every = (ms, op) => {
              if (!ms) return;
              let next = Date.now() + ms;
              socket.setInterval(() => {
                if (Date.now() >= stop - 1000) return;
                // Stop writes before end to allow at least five seconds for echo delivery.
                if (['chat', 'save'].includes(op) && Date.now() >= end - 5000) return;
                const missed = Math.max(0, Math.floor((Date.now() - next) / ms));
                skipped.add(missed, { op }); next += (missed + 1) * ms;
                action(c, op, op === 'chat');
              }, ms);
            };
            every(POLL_MS, 'access');
            if (active) { every(SAVE_MS, 'save'); every(CHAT_MS, 'chat'); every(10000, 'project'); }
          } else if (message.type === 'events') {
            if (typeof message.nextCursor !== 'string' || !/^(0|[1-9]\d*)$/.test(message.nextCursor)) {
              protocolErrors.add(1); return;
            }
            if (compareSequence(message.nextCursor, c.cursor) < 0) cursorErrors.add(1);
            else c.cursor = message.nextCursor;
            for (const event of message.events || []) {
              const id = event.data?.message?.clientMessageId;
              if (id && c.pending.has(id)) {
                echoLatency.add(Date.now() - c.pending.get(id)); c.pending.delete(id);
              }
            }
          }
        });
        socket.on('error', () => { /* Close/ready metrics record failure without logging credentials. */ });
      });
    authenticated.add(result?.status === 101 && readyAt > 0);
    if (readyAt) connectedMs.add(Date.now() - readyAt);
    if (!plannedClose) { closeErrors.add(1); retries++; }
    else retries = 0;
    if (retries > 10) break;
    if (Date.now() < end) sleep(Math.min(10, 0.25 * 2 ** retries) + Math.random());
  }
  if (context) echoMissing.add(context.pending.size);
}
