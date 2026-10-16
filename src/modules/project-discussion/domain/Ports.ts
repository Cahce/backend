import type { ProjectActor, AccessView } from '../../projects/domain/sharing/Ports.js';
export type Author = { id: string | null; displayName: string };
export type MessageView = { id: string; projectId: string; seq: string; clientMessageId: string;
  author: Author; body: string | null; createdAt: string; deletedAt: string | null };
export type Anchor = { kind: 'project' } | { kind: 'file'; fileId: string } |
  { kind: 'range'; fileId: string; baseRevision: number; from: number; to: number; quote: string };
export type CommentView = { id: string; threadId: string; author: Author; body: string | null;
  revision: number; createdAt: string; deletedAt: string | null; clientCommentId: string };
export type ThreadView = { id: string; projectId: string; createdById: string | null; clientCommentId: string;
  anchor: Anchor; anchorStatus: 'current' | 'stale' | 'file_deleted'; filePath: string | null;
  state: 'open' | 'resolved'; revision: number; deletedAt: string | null; comments: CommentView[]; commentsNextCursor: string | null; updatedAt: string };
export type EventView = { type: string; projectId: string; seq: string; accessVersion: string; occurredAt: string; data: unknown };
export type DiscussionEventSnapshot = { access: AccessView; highWatermark: string; events: EventView[] };
export const MAX_REPLAY_ACTORS = 50;
export type DiscussionEventPage = { events: EventView[]; nextCursor: string; highWatermark: string; hasMore: boolean };
/** Errors stay internal: one actor's denial must not discard another actor's page. */
export type DiscussionEventBatchResult = { userId: string; snapshot: DiscussionEventSnapshot } | { userId: string; error: Error };
export type DiscussionEventPageResult = { userId: string; result: DiscussionEventPage } | { userId: string; error: Error };
export interface DiscussionTransaction {
  access: AccessView;
  head(): Promise<string>;
  history(before: string | undefined, limit: number): Promise<MessageView[]>;
  message(id: string): Promise<MessageView | null>;
  findSent(clientId: string): Promise<MessageView | null>;
  send(clientId: string, body: string): Promise<MessageView>;
  deleteMessage(id: string): Promise<void>;
  readState(seq?: string): Promise<{ lastReadMessageSeq: string; unreadCount: number }>;
  file(id: string): Promise<{ id: string; path: string; revision: number; content: string | null } | null>;
  threads(before?: string, limit?: number): Promise<ThreadView[]>;
  comments(threadId: string, after?: string, limit?: number): Promise<CommentView[]>;
  thread(id: string): Promise<ThreadView | null>;
  findCreatedThread(clientId: string): Promise<ThreadView | null>;
  createThread(clientId: string, body: string, anchor: Anchor, filePath: string | null): Promise<ThreadView>;
  addComment(threadId: string, clientId: string, body: string): Promise<CommentView>;
  findReply(threadId: string, clientId: string): Promise<CommentView | null>;
  comment(id: string): Promise<CommentView | null>;
  updateComment(id: string, body: string | null): Promise<CommentView>;
  updateThread(id: string, state?: 'open' | 'resolved', deleted?: boolean): Promise<ThreadView>;
}
export interface DiscussionRepository {
  run<T>(projectId: string, actor: ProjectActor, work: (tx: DiscussionTransaction) => Promise<T>): Promise<T>;
  readEvents(projectId: string, actor: ProjectActor, since: string, limit: number): Promise<DiscussionEventSnapshot>;
  /** A frozen same-project/cursor cohort; implementations must not retain fulfilled snapshots. */
  readEventsBatch?(projectId: string, actors: readonly ProjectActor[], since: string, limit: number): Promise<DiscussionEventBatchResult[]>;
}
