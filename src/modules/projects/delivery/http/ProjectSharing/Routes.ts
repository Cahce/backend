import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ProjectSharingUseCases } from '../../../application/sharing/ProjectSharingUseCases.js';
import { createShareSchema, updateShareSchema, receiveShareSchema, updateMemberSchema, shareLinkDto, sharingPageSchema } from './Dto.js';
import { RequestRateLimit } from '../../../application/sharing/RequestRateLimit.js';
import { sharingDocumentation } from './OpenApi.js';

const actor = (req: FastifyRequest) => ({ userId: req.user.sub, role: req.user.role });
type Params = { projectId: string; linkId: string; memberId: string };
const params = (req: FastifyRequest) => req.params as Params;

export async function projectSharingRoutes(app: FastifyInstance, useCases: ProjectSharingUseCases) {
  const limiter = app.requestRateLimit ?? new RequestRateLimit();
  const options = { preHandler: [app.auth.verify, async (req: FastifyRequest) => limiter.check(`sharing:${req.user.sub}`, 90)], schema: { tags: ['project-sharing'], security: [{ bearerAuth: [] }] } };
  const documented = (name: keyof typeof sharingDocumentation) => ({ ...options, ...sharingDocumentation[name] });
  app.addHook('onSend', async (_req, reply) => { reply.header('Cache-Control', 'no-store'); });
  app.get('/projects/shared', documented('shared'), req => { const q = sharingPageSchema.parse(req.query); return useCases.shared(actor(req), q.before, q.limit); });
  app.get('/projects/:projectId/access', documented('access'), async req => ({ access: await useCases.access(params(req).projectId, actor(req)) }));
  app.post('/projects/:projectId/share-links', documented('create'), async (req, reply) => {
    const created = await useCases.create(params(req).projectId, actor(req), createShareSchema.parse(req.body));
    return reply.code(201).send({ link: shareLinkDto(created.link), shareUrl: `/share/${created.link.id}#token=${created.token}` });
  });
  app.get('/projects/:projectId/share-links', documented('list'), async req => {
    const q = sharingPageSchema.parse(req.query), result = await useCases.list(params(req).projectId, actor(req), q.before, q.limit);
    return { links: result.links.map(shareLinkDto), nextCursor: result.nextCursor };
  });
  app.patch('/projects/:projectId/share-links/:linkId', documented('update'), async req => {
    const p = params(req);
    return { link: shareLinkDto((await useCases.update(p.projectId, p.linkId, actor(req), updateShareSchema.parse(req.body))).link) };
  });
  app.post('/projects/:projectId/share-links/:linkId/rotate', documented('rotate'), async req => {
    const p = params(req);
    const result = await useCases.update(p.projectId, p.linkId, actor(req), updateShareSchema.pick({ baseVersion: true }).parse(req.body), true);
    return { link: shareLinkDto(result.link), shareUrl: `/share/${result.link.id}#token=${result.token}` };
  });
  app.delete('/projects/:projectId/share-links/:linkId', documented('revoke'), async (req, reply) => {
    const p = params(req); await useCases.revoke(p.projectId, p.linkId, actor(req)); return reply.code(204).send();
  });
  for (const mode of ['resolve', 'redeem'] as const) {
    app.post(`/project-shares/${mode}`, documented(mode), async req => {
      const data = receiveShareSchema.parse(req.body);
      return useCases.receive(actor(req), data.linkId, data.token, mode === 'redeem');
    });
  }
  app.get('/projects/:projectId/members', documented('members'), req => { const q = sharingPageSchema.parse(req.query);
    return useCases.members(params(req).projectId, actor(req), q.before, q.limit); });
  app.patch('/projects/:projectId/members/:memberId', documented('updateMember'), async req => {
    const p = params(req); return { member: await useCases.changeMember(p.projectId, p.memberId, actor(req), updateMemberSchema.parse(req.body)) };
  });
  app.delete('/projects/:projectId/members/:memberId', documented('blockMember'), async (req, reply) => {
    const p = params(req); await useCases.changeMember(p.projectId, p.memberId, actor(req), {}, true); return reply.code(204).send();
  });
  app.post('/projects/:projectId/leave', documented('leave'), async (req, reply) => {
    await useCases.leave(params(req).projectId, actor(req)); return reply.code(204).send();
  });
}
