import type { FastifyInstance } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import type { RealtimeTickets } from '../../application/RealtimeTickets.js';
import type { RealtimeSocketLeases, RealtimeSocketLeaseHandle } from '../../application/RealtimeSocketLeases.js';
import { RealtimeSocketLeaseUnavailable } from '../../domain/RealtimeSocketLeaseStore.js';
import type { ProjectDiscussionUseCases } from '../../application/ProjectDiscussionUseCases.js';
import type { ProjectEventWakeSource, RealtimeSession } from '../../domain/RealtimePorts.js';
import { sequenceSchema } from '../http/Dto.js';

const firstFrame = z.object({ type: z.literal('authenticate'), ticket: z.string().regex(/^[A-Za-z0-9_-]{43}$/), since: sequenceSchema.default('0') }).strict();
const MAX_CONCURRENT_REPLAYS = 8;
const WAKE_WINDOW_MS = 25;
type SocketState = { session: RealtimeSession; cursor: string; pumping: boolean; pending: boolean; alive: boolean;
  lease: RealtimeSocketLeaseHandle; checking: boolean; deadline?: ReturnType<typeof setTimeout> };

export function registerProjectRealtime(app: FastifyInstance,
  tickets: Pick<RealtimeTickets, 'consume' | 'validate'>,
  uc: Pick<ProjectDiscussionUseCases, 'events'>, origins: readonly string[], leases: RealtimeSocketLeases,
  wakeSource?: ProjectEventWakeSource, maxConnections = 200) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  const sessions = new Map<WebSocket, SocketState>();
  const rooms = new Map<string, Set<WebSocket>>();
  const wakeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const queue = new Set<WebSocket>();
  let activePumps = 0, stopping = false;
  let scheduled: ReturnType<typeof setImmediate> | undefined;
  const allowed = new Set(origins);
  app.serviceMetrics?.bindRealtime(() => {
    const active = [...sessions].filter(([ws, state]) => ws.readyState === WebSocket.OPEN && state.lease.valid());
    return { connections: wss.clients.size, authenticated: active.length,
      accounts: new Set(active.map(([, state]) => state.session.actor.userId)).size,
      rooms: rooms.size, queued: queue.size, activeReplays: activePumps };
  });

  function remove(ws: WebSocket) {
    const state = sessions.get(ws);
    if (!state) return;
    clearTimeout(state.deadline);
    void state.lease.release();
    sessions.delete(ws); queue.delete(ws);
    const room = rooms.get(state.session.projectId);
    room?.delete(ws);
    if (!room?.size) {
      rooms.delete(state.session.projectId);
      clearTimeout(wakeTimers.get(state.session.projectId));
      wakeTimers.delete(state.session.projectId);
    }
  }
  function requestPump(ws: WebSocket) {
    const state = sessions.get(ws);
    if (stopping || !state || ws.readyState !== WebSocket.OPEN) return;
    if (!hasLease(ws, state)) return;
    state.pending = true;
    if (!state.pumping) queue.add(ws);
    scheduleDrain();
  }
  function scheduleDrain() {
    if (stopping || scheduled || activePumps >= MAX_CONCURRENT_REPLAYS || !queue.size) return;
    scheduled = setImmediate(() => {
      scheduled = undefined;
      while (!stopping && queue.size && activePumps < MAX_CONCURRENT_REPLAYS) {
        const ws = queue.values().next().value!; queue.delete(ws);
        const state = sessions.get(ws);
        if (!state || state.pumping || ws.readyState !== WebSocket.OPEN) continue;
        state.pumping = true; state.pending = false; activePumps++;
        void pumpPage(ws, state).finally(() => {
          state.pumping = false; activePumps--;
          if (!stopping && sessions.get(ws) === state && state.pending && ws.readyState === WebSocket.OPEN) queue.add(ws);
          scheduleDrain();
        });
      }
    });
  }
  async function pumpPage(ws: WebSocket, state: SocketState) {
    try {
      if (!hasLease(ws, state)) return;
      if (ws.bufferedAmount > 1_048_576) { ws.close(4429, 'Slow consumer'); return; }
      const result = await uc.events(state.session.projectId, state.session.actor, state.cursor, 100);
      if (stopping || sessions.get(ws) !== state || ws.readyState !== WebSocket.OPEN) return;
      if (!hasLease(ws, state)) return;
      // Always reauthorize after the read, even when the periodic check just succeeded.
      if (!(await tickets.validate(state.session))) { ws.close(4403, 'Access changed'); return; }
      if (ws.bufferedAmount > 1_048_576) { ws.close(4429, 'Slow consumer'); return; }
      if (stopping || sessions.get(ws) !== state || ws.readyState !== WebSocket.OPEN) return;
      if (!hasLease(ws, state)) return;
      if (result.events.length || result.nextCursor !== state.cursor) ws.send(JSON.stringify({ type: 'events', ...result }));
      state.cursor = result.nextCursor;
      // Yield between pages and return to the tail so a large backlog cannot monopolize replay slots.
      state.pending ||= result.hasMore;
    } catch { ws.close(4403, 'Access unavailable'); }
  }
  function hasLease(ws: WebSocket, state: SocketState) {
    if (state.lease.valid()) return true;
    ws.close(1013, 'Capacity lease expired'); return false;
  }
  const unsubscribe = wakeSource?.subscribe(projectId => {
    if (stopping || !rooms.has(projectId) || wakeTimers.has(projectId)) return;
    const timer = setTimeout(() => {
      wakeTimers.delete(projectId);
      for (const ws of rooms.get(projectId) ?? []) requestPump(ws);
    }, WAKE_WINDOW_MS);
    timer.unref(); wakeTimers.set(projectId, timer);
  });
  if (wakeSource) app.addHook('onReady', () => wakeSource.start());

  const upgrade: Parameters<typeof app.server.on<'upgrade'>>[1] = (req, socket, head) => {
    const match = /^\/api\/v1\/projects\/([^/?]+)\/realtime$/.exec(req.url ?? '');
    if (!match) return;
    if (stopping || app.lifecycle?.isDraining || (app.sharedRedis && !app.sharedRedis.isReady)) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nRetry-After: 1\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    if (!req.headers.origin || !allowed.has(req.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    if (wss.clients.size >= maxConnections) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nRetry-After: 1\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(req, socket, head, ws => {
      const timeout = setTimeout(() => ws.close(4401, 'Authentication required'), 5000);
      let authenticating = false;
      ws.on('error', () => ws.terminate());
      ws.on('close', () => { clearTimeout(timeout); remove(ws); });
      ws.on('pong', () => { const state = sessions.get(ws); if (state) state.alive = true; });
      ws.on('message', async raw => {
        if (authenticating || sessions.has(ws)) { ws.close(4400, 'Unexpected frame'); return; }
        authenticating = true;
        try {
          const frame = firstFrame.parse(JSON.parse(raw.toString()));
          const session = await tickets.consume(decodeURIComponent(match[1]), frame.ticket);
          const lease = await leases.acquire(session.actor.userId, () => ws.close(1013, 'Capacity lease unavailable'));
          if (!lease) {
            ws.close(4429, 'Connection limit'); return;
          }
          if (stopping || ws.readyState !== WebSocket.OPEN || !lease.valid()) { await lease.release(); return; }
          clearTimeout(timeout);
          sessions.set(ws, { session, lease, cursor: frame.since, pumping: false, pending: false, alive: true, checking: false });
          const room = rooms.get(session.projectId) ?? new Set<WebSocket>();
          room.add(ws); rooms.set(session.projectId, room);
          ws.send(JSON.stringify({ type: 'ready', projectId: session.projectId }));
          requestPump(ws);
        } catch (error) {
          ws.close(error instanceof RealtimeSocketLeaseUnavailable ? 1013 : 4403, 'Access unavailable');
        }
      });
    });
  };
  app.server.on('upgrade', upgrade);

  // Fallback covers lost notifications, listener reconnect and writes from older instances.
  const fallback = setInterval(() => { for (const ws of sessions.keys()) requestPump(ws); }, wakeSource ? 10_000 : 2000);
  fallback.unref();
  const authorization = setInterval(() => {
    for (const [ws, state] of sessions) {
      if (state.checking || ws.readyState !== WebSocket.OPEN || !hasLease(ws, state)) continue;
      state.checking = true;
      // Independent of replay queues, with a fail-closed deadline below five seconds.
      state.deadline = setTimeout(() => ws.close(4403, 'Session check timeout'), 2500);
      tickets.validate(state.session).then(valid => { if (!valid) ws.close(4403, 'Access changed'); })
        .catch(() => ws.close(4403, 'Access unavailable')).finally(() => {
          clearTimeout(state.deadline); state.deadline = undefined; state.checking = false;
        });
    }
  }, 2000);
  authorization.unref();
  const heartbeat = setInterval(() => { for (const [ws, state] of sessions) {
    if (!state.alive) { ws.terminate(); continue; } state.alive = false; ws.ping();
  } }, 30_000);
  heartbeat.unref();
  app.addHook('preClose', async () => {
    stopping = true; unsubscribe?.();
    clearInterval(fallback); clearInterval(authorization); clearInterval(heartbeat);
    if (scheduled) clearImmediate(scheduled);
    for (const timer of wakeTimers.values()) clearTimeout(timer);
    wakeTimers.clear(); queue.clear(); app.server.off('upgrade', upgrade);
    const closed = new Promise<void>(resolve => {
      const deadline = setTimeout(() => {
        for (const ws of wss.clients) ws.terminate();
      }, 2000);
      deadline.unref();
      wss.close(() => { clearTimeout(deadline); resolve(); });
      for (const ws of wss.clients) { remove(ws); ws.close(1012, 'Service restart'); }
    });
    await Promise.all([closed, wakeSource?.stop(), leases.stop()]);
  });
}
