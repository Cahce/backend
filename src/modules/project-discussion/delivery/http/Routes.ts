import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ProjectDiscussionUseCases } from '../../application/ProjectDiscussionUseCases.js';
import { pageSchema, commentPageSchema, messageSchema, threadSchema, replySchema, revisionSchema, editThreadSchema, editCommentSchema, readSchema, eventsSchema } from './Dto.js';
import { RequestRateLimit } from '../../../projects/application/sharing/RequestRateLimit.js';
import { discussionDocumentation } from './OpenApi.js';
const actor = (req: FastifyRequest) => ({ userId: req.user.sub, role: req.user.role });
const params = (req: FastifyRequest) => req.params as { projectId: string; messageId: string; threadId: string; commentId: string };
export async function projectDiscussionRoutes(app: FastifyInstance, uc: ProjectDiscussionUseCases) {
  const limiter = app.requestRateLimit ?? new RequestRateLimit();
  const opts = { preHandler: [app.auth.verify, async (req: FastifyRequest) => limiter.check(`discussion:${req.method === 'GET' ? 'read' : 'write'}:${req.user.sub}`, req.method === 'GET' ? 300 : 120)],
    schema: { tags: ['project-discussion'], security: [{ bearerAuth: [] }] } };
  const documented = (name: keyof typeof discussionDocumentation) => ({ ...opts, ...discussionDocumentation[name] });
  app.addHook('onSend', async (_req, reply) => { reply.header('Cache-Control', 'no-store'); });
  app.get('/projects/:projectId/chat/messages', documented('history'), req => {
    const q = pageSchema.parse(req.query); return uc.history(params(req).projectId, actor(req), q.before, q.limit);
  });
  app.post('/projects/:projectId/chat/messages', documented('send'), async (req, reply) => {
    const d = messageSchema.parse(req.body); const r = await uc.send(params(req).projectId, actor(req), d.clientMessageId, d.body);
    return reply.code(r.created ? 201 : 200).send(r);
  });
  app.delete('/projects/:projectId/chat/messages/:messageId', documented('deleteMessage'), async (req, reply) => {
    const p = params(req); await uc.deleteMessage(p.projectId, actor(req), p.messageId); return reply.code(204).send();
  });
  app.get('/projects/:projectId/chat/read-state', documented('readState'), req => uc.readState(params(req).projectId, actor(req)));
  app.put('/projects/:projectId/chat/read-state', documented('markRead'), req => uc.readState(params(req).projectId, actor(req), readSchema.parse(req.body).lastReadMessageSeq));
  app.get('/projects/:projectId/comments/threads', documented('threads'), req => { const q = commentPageSchema.parse(req.query); return uc.threads(params(req).projectId, actor(req), q.before, q.limit); });
  app.get('/projects/:projectId/comments/threads/:threadId/replies', documented('replies'), req => { const p = params(req), q = commentPageSchema.parse(req.query); return uc.comments(p.projectId, actor(req), p.threadId, q.after, q.limit); });
  app.post('/projects/:projectId/comments/threads', documented('createThread'), async (req, reply) => {
    const d = threadSchema.parse(req.body); return reply.code(201).send({ thread: await uc.createThread(params(req).projectId, actor(req), d.clientCommentId, d.body, d.anchor) });
  });
  app.post('/projects/:projectId/comments/threads/:threadId/replies', documented('reply'), async (req, reply) => {
    const p = params(req), d = replySchema.parse(req.body);
    return reply.code(201).send({ comment: await uc.reply(p.projectId, actor(req), p.threadId, d.clientCommentId, d.body) });
  });
  app.patch('/projects/:projectId/comments/threads/:threadId', documented('changeThread'), async req => {
    const p = params(req), d = editThreadSchema.parse(req.body);
    return { thread: await uc.changeThread(p.projectId, actor(req), p.threadId, d.baseRevision, d.state) };
  });
  app.delete('/projects/:projectId/comments/threads/:threadId', documented('deleteThread'), async req => {
    const p = params(req), d = revisionSchema.parse(req.body);
    return { thread: await uc.changeThread(p.projectId, actor(req), p.threadId, d.baseRevision, undefined, true) };
  });
  app.patch('/projects/:projectId/comments/:commentId', documented('editComment'), async req => {
    const p = params(req), d = editCommentSchema.parse(req.body);
    return { comment: await uc.changeComment(p.projectId, actor(req), p.commentId, d.baseRevision, d.body) };
  });
  app.delete('/projects/:projectId/comments/:commentId', documented('deleteComment'), async req => {
    const p = params(req), d = revisionSchema.parse(req.body);
    return { comment: await uc.changeComment(p.projectId, actor(req), p.commentId, d.baseRevision, null) };
  });
  app.get('/projects/:projectId/events', documented('events'), req => {
    const q = eventsSchema.parse(req.query); return uc.events(params(req).projectId, actor(req), q.since, q.limit);
  });
}
