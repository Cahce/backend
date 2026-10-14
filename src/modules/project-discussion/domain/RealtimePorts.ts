import type { ProjectActor } from '../../projects/domain/sharing/Ports.js';
export type RealtimeSession = { actor: ProjectActor; projectId: string; jti: string; expiresAt: number };
export interface RealtimeSessionPolicy { validate(session: RealtimeSession): Promise<boolean> }
/** Best-effort wake hint only. Durable event reads and authorization remain authoritative. */
export interface ProjectEventWakeSource {
  start(): Promise<void>;
  subscribe(listener: (projectId: string) => void): () => void;
  stop(): Promise<void>;
}
