import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import type { OpenAPIV3 } from 'openapi-types';
import type { AppConfig } from '../../../config/index.js';
import { swaggerPlugin } from '../../../swagger/index.js';
import { toErrorResponse } from '../../../shared/http/domainError.js';
import { CollaborationError } from '../../projects/domain/access/CollaborationErrors.js';
import { ProjectSharingUseCases } from '../../projects/application/sharing/ProjectSharingUseCases.js';
import type { SharingRepository, ShareTokenPort } from '../../projects/domain/sharing/Ports.js';
import { projectSharingRoutes } from '../../projects/delivery/http/ProjectSharing/Routes.js';
import { ProjectDiscussionUseCases } from '../application/ProjectDiscussionUseCases.js';
import type { DiscussionRepository } from '../domain/Ports.js';
import { projectDiscussionRoutes } from '../delivery/http/Routes.js';
import { discussionDocumentation } from '../delivery/http/OpenApi.js';

async function fixture(docs = true) {
  const app = Fastify();
  app.decorate('config', { swagger: { routePrefix: '/docs' } } as AppConfig);
  // Only verify is used by the actual route registration under test.
  const unusedGuard = async () => { throw new Error('Unexpected authorization guard in transport fixture'); };
  const auth: FastifyInstance['auth'] = { verify: async request => {
    if (!request.headers.authorization) throw new CollaborationError('TOKEN_REQUIRED', 'Cần đăng nhập', 401);
    request.user = { sub: 'fixture-user', role: 'student', email: 'fixture@example.invalid', jti: 'test-jti', exp: 9_999_999_999 };
  }, requireAdmin: unusedGuard, requireRoles: () => unusedGuard, requirePermission: () => unusedGuard };
  app.decorate('auth', auth);
  app.setErrorHandler((error, _request, reply) => { const mapped = toErrorResponse(error); return reply.code(mapped.status).send(mapped.body); });
  if (docs) await app.register(swaggerPlugin);
  // Metadata enumeration does not call repositories. A few methods below provide controlled transport results.
  const sharing = new ProjectSharingUseCases({} as SharingRepository, {} as ShareTokenPort);
  const discussion = new ProjectDiscussionUseCases({} as DiscussionRepository);
  let receivedLimit: number | undefined;
  discussion.history = async (_project, _actor, _before, limit) => {
    receivedLimit = limit;
    return { messages: [], nextCursor: null, highWatermark: '9223372036854775807', untouchedExtraField: { nested: true } };
  };
  sharing.revoke = async () => {};
  await app.register(async child => {
    await projectSharingRoutes(child, sharing);
    await projectDiscussionRoutes(child, discussion);
    child.post('/projects/:projectId/realtime-ticket', { preHandler: child.auth.verify, ...discussionDocumentation.ticket }, async () => ({ ticket: randomBytes(32).toString('base64url'), expiresAt: '2100-01-01T00:00:00.000Z' }));
  }, { prefix: '/api/v1' });
  await app.ready();
  return { app, limit: () => receivedLimit };
}
const refSchema = (value: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined): OpenAPIV3.SchemaObject => {
  assert(value && !('$ref' in value)); return value;
};
const operation = (doc: OpenAPIV3.Document, path: string, method: OpenAPIV3.HttpMethods) => {
  const value = doc.paths[`/api/v1${path}`]?.[method]; assert(value); return value;
};
const responseSchema = (op: OpenAPIV3.OperationObject, status: number) => {
  const value = op.responses[String(status)]; assert(value && !('$ref' in value));
  return refSchema(value.content?.['application/json']?.schema);
};
const bodySchema = (op: OpenAPIV3.OperationObject) => {
  assert(op.requestBody && !('$ref' in op.requestBody));
  return refSchema(op.requestBody.content['application/json'].schema);
};

test('generated Swagger documents every sharing/discussion/ticket operation with auth and exact transport shapes', async () => {
  const { app } = await fixture();
  try {
    const doc = app.swagger() as OpenAPIV3.Document;
    const operations = Object.values(doc.paths).flatMap(path => Object.entries(path ?? {})
      .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
      .map(([, value]) => value as OpenAPIV3.OperationObject));
    assert.equal(operations.length, 28);
    assert.equal(new Set(operations.map(op => op.operationId)).size, 28);
    for (const op of operations) {
      assert(op.operationId && op.summary && op.description);
      assert.deepEqual(op.security, [{ bearerAuth: [] }]);
      for (const code of [400, 401, 403, 404, 429, 500, 503]) assert(op.responses[String(code)], `${op.operationId}: ${code}`);
      assert(!JSON.stringify(op).includes('"tokenHash":'));
    }
    const create = operation(doc, '/projects/{projectId}/share-links', 'post' as OpenAPIV3.HttpMethods);
    assert.deepEqual(bodySchema(create).required, ['role', 'expiresAt']);
    assert.deepEqual(refSchema(bodySchema(create).properties?.role).enum, ['viewer', 'commenter', 'editor']);
    assert.equal(refSchema(bodySchema(create).properties?.expiresAt).nullable, true);
    assert.equal(bodySchema(create).additionalProperties, false);
    assert(responseSchema(create, 201).properties?.shareUrl);
    const send = operation(doc, '/projects/{projectId}/chat/messages', 'post' as OpenAPIV3.HttpMethods);
    for (const status of [200, 201]) {
      const message = refSchema(responseSchema(send, status).properties?.message);
      assert.equal(refSchema(message.properties?.seq).type, 'string');
      assert.equal(refSchema(message.properties?.body).nullable, true);
      assert.deepEqual(refSchema(responseSchema(send, status)).required, ['message', 'created']);
    }
    const deletion = operation(doc, '/projects/{projectId}/share-links/{linkId}', 'delete' as OpenAPIV3.HttpMethods).responses['204'];
    assert(deletion && !('$ref' in deletion)); assert.equal(deletion.content, undefined);
    const threadDelete = operation(doc, '/projects/{projectId}/comments/threads/{threadId}', 'delete' as OpenAPIV3.HttpMethods);
    assert.deepEqual(bodySchema(threadDelete).required, ['baseRevision']); assert(threadDelete.responses['200']);
    const deletedThread = refSchema(responseSchema(threadDelete, 200).properties?.thread);
    for (const value of [bodySchema(threadDelete).properties?.baseRevision, deletedThread.properties?.revision]) {
      const revision = refSchema(value);
      assert.equal(revision.type, 'integer');
      assert.equal(revision.minimum, 0);
      assert.equal(revision.exclusiveMinimum, true);
    }
    const anchor = refSchema(bodySchema(operation(doc, '/projects/{projectId}/comments/threads', 'post' as OpenAPIV3.HttpMethods)).properties?.anchor);
    assert.equal((anchor.oneOf ?? anchor.anyOf)?.length, 3);
    const updateMember = operation(doc, '/projects/{projectId}/members/{memberId}', 'patch' as OpenAPIV3.HttpMethods);
    const members = responseSchema(updateMember, 200);
    const member = refSchema(members.properties?.member);
    assert(member.properties?.changedAt && member.properties.projectId);
    assert.equal(member.properties?.displayName, undefined); assert.equal(member.properties?.effectiveRole, undefined);
    for (const role of [bodySchema(updateMember).properties?.roleOverride, member.properties?.roleOverride]) {
      assert.equal(refSchema(role).nullable, true);
      assert.deepEqual(refSchema(role).enum, ['viewer', 'commenter', 'editor', null]);
    }
    const replies = operation(doc, '/projects/{projectId}/comments/threads/{threadId}/replies', 'get' as OpenAPIV3.HttpMethods);
    const limit = replies.parameters?.find(p => !('$ref' in p) && p.name === 'limit') as OpenAPIV3.ParameterObject;
    assert.equal(refSchema(limit.schema).default, 25); assert.equal(limit.required, false);
    assert.equal(refSchema(limit.schema).maximum, 50);
    const json = await app.inject('/docs/json'); assert.equal(json.statusCode, 200);
    assert.equal(json.json().paths['/api/v1/projects/{projectId}/realtime-ticket'].post.operationId, 'createProjectRealtimeTicket');
  } finally { await app.close(); }
});

test('documentation preserves runtime validation, auth order, headers, decimal strings and serialization with Swagger on or off', async () => {
  const results: unknown[] = [];
  for (const docs of [false, true]) {
    const { app, limit } = await fixture(docs);
    try {
      if (docs) app.swagger();
      const headers = { authorization: 'test-only-transport-fixture' };
      const history = await app.inject({ url: '/api/v1/projects/p/chat/messages?limit=3', headers });
      assert.equal(history.statusCode, 200); assert.equal(limit(), 3);
      assert.equal(history.json().highWatermark, '9223372036854775807');
      assert.deepEqual(history.json().untouchedExtraField, { nested: true });
      assert.equal(history.headers['cache-control'], 'no-store');
      const unknown = await app.inject({ method: 'POST', url: '/api/v1/projects/p/share-links', headers, payload: { role: 'viewer', expiresAt: null, forged: true } });
      assert.equal(unknown.statusCode, 400); assert.equal(unknown.json().error.code, 'VALIDATION_ERROR');
      const unauthorized = await app.inject({ method: 'POST', url: '/api/v1/projects/p/share-links', payload: {} });
      assert.equal(unauthorized.statusCode, 401);
      const tooLarge = await app.inject({ url: '/api/v1/projects/p/events?since=9223372036854775808', headers });
      assert.equal(tooLarge.statusCode, 400);
      const noContent = await app.inject({ method: 'DELETE', url: '/api/v1/projects/p/share-links/l', headers });
      assert.equal(noContent.statusCode, 204); assert.equal(noContent.body, '');
      results.push([history.json(), unknown.json(), unauthorized.json(), tooLarge.json(), noContent.statusCode]);
    } finally { await app.close(); }
  }
  assert.deepEqual(results[0], results[1]);
});
