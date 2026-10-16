import type { FastifyInstance } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import type { RealtimeTickets } from '../../application/RealtimeTickets.js';
import type { RealtimeSocketLeases, RealtimeSocketLeaseHandle } from '../../application/RealtimeSocketLeases.js';
import { RealtimeSocketLeaseUnavailable } from '../../domain/RealtimeSocketLeaseStore.js';
import type { ProjectDiscussionUseCases } from '../../application/ProjectDiscussionUseCases.js';
import type { ProjectEventWakeSource, RealtimeSession } from '../../domain/RealtimePorts.js';
import { MAX_REPLAY_ACTORS, type DiscussionEventPage, type DiscussionEventPageResult } from '../../domain/Ports.js';
import { sequenceSchema } from '../http/Dto.js';

const firstFrame = z.object({ type: z.literal('authenticate'), ticket: z.string().regex(/^[A-Za-z0-9_-]{43}$/), since: sequenceSchema.default('0') }).strict();
const MAX_CONCURRENT_REPLAYS = 8;
const WAKE_WINDOW_MS = 25;
type SocketState = { session: RealtimeSession; cursor: string; pumping: boolean; pending: boolean; alive: boolean;
  lease: RealtimeSocketLeaseHandle; checking: boolean; deadline?: ReturnType<typeof setTimeout> };
type ReplayRecipient = { ws: WebSocket; state: SocketState; cursor: string };

export function registerProjectRealtime(app: FastifyInstance,
  tickets: Pick<RealtimeTickets, 'consume' | 'validate'>,
  uc: Pick<ProjectDiscussionUseCases, 'events'> & Partial<Pick<ProjectDiscussionUseCases, 'eventsBatch'>>,
  origins: readonly string[], leases: RealtimeSocketLeases,
  wakeSource?: ProjectEventWakeSource, maxConnections = 200) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  const sessions = new Map<WebSocket, SocketState>();
  const rooms = new Map<string, Set<WebSocket>>();
  const wakeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const queue = new Set<WebSocket>();
  let activePumps = 0, activeReplayRecipients = 0, stopping = false;
  let scheduled: ReturnType<typeof setImmediate> | undefined;
  const allowed = new Set(origins);
  app.serviceMetrics?.bindRealtime(() => {
    const active = [...sessions].filter(([ws, state]) => ws.readyState === WebSocket.OPEN && state.lease.valid());
    return { connections: wss.clients.size, authenticated: active.length,
      accounts: new Set(active.map(([, state]) => state.session.actor.userId)).size,
      rooms: rooms.size, queued: queue.size, activeReplays: activePumps, activeReplayRecipients };
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
        const cohort = takeCohort();
        if (!cohort.length) continue;
        activePumps++; activeReplayRecipients += cohort.length;
        void pumpCohort(cohort).finally(() => {
          activePumps--; activeReplayRecipients -= cohort.length;
          for (const { ws, state } of cohort) {
            state.pumping = false;
            if (!stopping && sessions.get(ws) === state && state.pending && ws.readyState === WebSocket.OPEN) queue.add(ws);
          }
          scheduleDrain();
        });
      }
    });
  }
  function takeCohort(): ReplayRecipient[] {
    const cohort: ReplayRecipient[] = [];
    // Only queued peers may join. A later arrival cannot reuse this dispatched snapshot.
    for (const ws of queue) {
      const state = sessions.get(ws);
      if (!state || state.pumping || ws.readyState !== WebSocket.OPEN) { queue.delete(ws); continue; }
      if (!hasLease(ws, state)) { queue.delete(ws); continue; }
      const first = cohort[0];
      if (first && (state.session.projectId !== first.state.session.projectId || state.cursor !== first.cursor)) continue;
      queue.delete(ws); state.pumping = true; state.pending = false;
      cohort.push({ ws, state, cursor: state.cursor });
      if (cohort.length === MAX_REPLAY_ACTORS) break;
    }
    return cohort;
  }
  function canSend({ ws, state }: ReplayRecipient) {
    if (stopping || sessions.get(ws) !== state || ws.readyState !== WebSocket.OPEN || !hasLease(ws, state)) return false;
    if (ws.bufferedAmount > 1_048_576) { ws.close(4429, 'Slow consumer'); return false; }
    return true;
  }
  async function pumpCohort(cohort: readonly ReplayRecipient[]) {
    const recipients = cohort.filter(canSend);
    if (!recipients.length) return;
    const first = recipients[0];
    try {
      const actors = [...new Map(recipients.map(({ state }) => [state.session.actor.userId, state.session.actor])).values()];
      const results = uc.eventsBatch ? await uc.eventsBatch(first.state.session.projectId, actors, first.cursor, 100) :
        await Promise.all(actors.map(async (actor): Promise<DiscussionEventPageResult> => {
          try { return { userId: actor.userId, result: await uc.events(first.state.session.projectId, actor, first.cursor, 100) }; }
          catch (error) { return { userId: actor.userId, error: error instanceof Error ? error : new Error('Replay unavailable') }; }
        }));
      const byUser = new Map(results.map(entry => [entry.userId, entry]));
      await Promise.all(recipients.map(recipient => {
        const entry = byUser.get(recipient.state.session.actor.userId);
        if (!entry || 'error' in entry) { if (canSend(recipient)) recipient.ws.close(4403, 'Access unavailable'); return; }
        return deliverPage(recipient, entry.result);
      }));
    } catch {
      for (const recipient of recipients) if (canSend(recipient)) recipient.ws.close(4403, 'Access unavailable');
    }
  }
  async function deliverPage(recipient: ReplayRecipient, result: DiscussionEventPage) {
    const { ws, state, cursor } = recipient;
    try {
      if (!canSend(recipient)) return;
      // Always reauthorize this JTI after the shared snapshot, even when the periodic check just succeeded.
      if (!(await tickets.validate(state.session))) { ws.close(4403, 'Access changed'); return; }
      if (!canSend(recipient)) return;
      if (result.events.length || result.nextCursor !== cursor) ws.send(JSON.stringify({ type: 'events', ...result }));
      state.cursor = result.nextCursor;
      // Yield between pages and return each recipient to the tail for backlog fairness.
      state.pending ||= result.hasMore;
    } catch { if (canSend(recipient)) ws.close(4403, 'Access unavailable'); }
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
