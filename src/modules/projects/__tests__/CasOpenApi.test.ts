import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { Ajv } from 'ajv';
import type { OpenAPIV3 } from 'openapi-types';
import type { AppConfig } from '../../../config/index.js';
import type { PrismaClient } from '../../../generated/prisma/index.js';
import { swaggerPlugin } from '../../../swagger/index.js';
import { toErrorResponse } from '../../../shared/http/domainError.js';
import type { BlobStorage } from '../../../shared/storage/BlobStorage.js';
import { CollaborationError } from '../domain/access/CollaborationErrors.js';
import { capabilitiesFor } from '../domain/Project/Policies.js';
import { TemplateCategory } from '../domain/Project/Types.js';
import { ProjectSettings } from '../domain/ProjectSettings.js';
import { ProjectsContainer } from '../Container.js';
import { ProjectFilesContainer } from '../../project-files/Container.js';
import { FileKind, StorageMode, type File } from '../../project-files/domain/ProjectFile/Types.js';
import { MockFileRepo } from '../../project-files/__tests__/mocks/MockFileRepo.js';
import { projectRoutes } from '../delivery/http/Project/Routes.js';
import { projectSettingsRoutes } from '../delivery/http/ProjectSettings/Routes.js';
import { projectFileRoutes } from '../../project-files/delivery/http/ProjectFile/Routes.js';

const date = new Date('2026-10-14T00:00:00.000Z');
const project = { id: 'p', metadataRevision: 7, title: 'Fixture', category: TemplateCategory.Thesis,
  ownerId: 'fixture-user', templateId: null, templateVersionId: null, createdAt: date, updatedAt: date, lastEditedAt: null };
const file: File = { id: 'f', projectId: 'p', revision: 7, path: 'chapters/ghi chú.typ', kind: FileKind.Typst,
  storageMode: StorageMode.Inline, textContent: 'Nội dung fixture', storageKey: null, mimeType: 'text/plain',
  sizeBytes: 20, sha256: 'fixture-hash', createdAt: date, updatedAt: date, lastEditedAt: date };
const binaryFile: File = { ...file, id: 'binary-file', path: 'assets/image.png', kind: FileKind.Image,
  storageMode: StorageMode.ObjectStorage, textContent: null, storageKey: 'fixture-binary', mimeType: 'image/png', sizeBytes: 4 };
const fileMetadata = { id: file.id, projectId: file.projectId, revision: file.revision, path: file.path, kind: file.kind,
  mimeType: file.mimeType, sizeBytes: file.sizeBytes, createdAt: date, updatedAt: date, lastEditedAt: date };
const ok = <T>(data: T) => ({ success: true as const, data });
const conflict = { success: false as const, error: { code: 'FILE_VERSION_CONFLICT', message: 'Tệp đã thay đổi' } };

async function fixture(docs: boolean) {
  const app = Fastify();
  app.decorate('config', { swagger: { routePrefix: '/docs' } } as AppConfig);
  const unusedGuard = async () => { throw new Error('Unexpected guard'); };
  const auth: FastifyInstance['auth'] = { verify: async request => {
    if (!request.headers.authorization) throw new CollaborationError('TOKEN_REQUIRED', 'Cần đăng nhập', 401);
    request.user = { sub: 'fixture-user', role: 'student', email: 'fixture@example.invalid', jti: 'fixture-jti' };
  }, requireAdmin: unusedGuard, requireRoles: () => unusedGuard, requirePermission: () => unusedGuard };
  app.decorate('auth', auth);
  const storage: BlobStorage = { get: async () => Readable.from(Buffer.from([1, 2, 3, 4])),
    put: async () => { throw new Error('Unexpected storage write'); }, head: async () => null, delete: async () => {} };
  app.decorate('storage', storage);
  app.setErrorHandler((error, _req, reply) => {
    if ((error as { validation?: unknown }).validation) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ' } });
    const result = toErrorResponse(error); return reply.code(result.status).send(result.body);
  });
  await app.register(multipart, { limits: { fileSize: 128 } });
  if (docs) await app.register(swaggerPlugin);
  // Containers construct repositories but no stubbed use case below calls Prisma or filesystem storage.
  const projects = new ProjectsContainer({} as PrismaClient, new MockFileRepo());
  const files = new ProjectFilesContainer({} as PrismaClient, projects.getProjectRepo());
  const commands: Array<{ kind: string; command: unknown }> = [];
  projects.listProjectsUseCase.execute = async () => ok([project]);
  projects.createProjectUseCase.execute = async command => { commands.push({ kind: 'project-create', command }); return ok(project); };
  projects.getProjectUseCase.execute = async () => ok({ ...project, access: { ...capabilitiesFor('owner'), version: '1', validUntil: null } });
  projects.updateProjectUseCase.execute = async command => {
    commands.push({ kind: 'project-update', command });
    return command.baseRevision === 7 ? ok({ ...project, metadataRevision: 8 })
      : { success: false, error: { code: 'PROJECT_VERSION_CONFLICT', message: 'Dự án đã thay đổi' } };
  };
  projects.deleteProjectUseCase.execute = async command => { commands.push({ kind: 'project-delete', command }); return ok(undefined); };
  projects.wireZipPortability(storage, { requireProjectAccess: async () => {} });
  projects.exportProjectUseCase!.execute = async command => {
    commands.push({ kind: 'project-export', command });
    return ok({ filename: 'Đồ án.zip', stream: Readable.from(Buffer.from([80, 75, 3, 4])) });
  };
  projects.importProjectUseCase!.execute = async command => {
    commands.push({ kind: 'project-import', command: { ...command, archiveBuffer: command.archiveBuffer.toString('hex') } });
    return ok({ project });
  };
  projects.duplicateProjectUseCase!.execute = async command => { commands.push({ kind: 'project-duplicate', command }); return ok({ project }); };
  const settings = new ProjectSettings('p', 'main.typ', { ppi: 144 }, null, null, date, 7);
  projects.getProjectSettings.execute = async () => settings;
  projects.updateProjectSettings.execute = async command => {
    commands.push({ kind: 'settings-update', command });
    if (command.baseRevision !== 7) throw new CollaborationError('SETTINGS_VERSION_CONFLICT', 'Thiết lập đã thay đổi', 409);
    return new ProjectSettings('p', 'main.typ', command.patch.compileOptions ?? {}, null, null, date, 8);
  };
  files.listFilesUseCase.execute = async () => ok([fileMetadata]);
  files.createFileUseCase.execute = async command => { commands.push({ kind: 'file-create', command }); return ok(file); };
  files.getFileUseCase.execute = async command => { commands.push({ kind: 'file-get', command }); return ok(command.path.endsWith('.png') ? binaryFile : file); };
  files.updateFileUseCase.execute = async command => {
    commands.push({ kind: 'file-update', command }); return command.baseRevision === 7 && command.fileId === 'f' ? ok({ ...file, revision: 8 }) : conflict;
  };
  files.renameFileUseCase.execute = async command => {
    commands.push({ kind: 'file-rename', command }); return command.baseRevision === 7 && command.fileId === 'f' ? ok({ ...file, path: command.newPath, revision: 8 }) : conflict;
  };
  files.wireBinaryUpload(storage, { requireWriteAccess: async () => {} });
  files.uploadBinaryFileUseCase!.execute = async command => {
    commands.push({ kind: 'file-upload', command: { projectId: command.projectId, path: command.path, kind: command.kind, declaredMimeType: command.declaredMimeType } });
    for await (const _chunk of command.stream) { /* drain the real multipart stream */ }
    return binaryFile;
  };
  files.deleteFileUseCase.execute = async command => {
    commands.push({ kind: 'file-delete', command }); return command.baseRevision === 7 && command.fileId === 'f' ? ok(undefined) : conflict;
  };
  await app.register(async child => {
    await projectRoutes(child, projects); await projectSettingsRoutes(child, projects); await projectFileRoutes(child, files);
  }, { prefix: '/api/v1' });
  await app.ready();
  return { app, commands, projects };
}
const schema = (value: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined): OpenAPIV3.SchemaObject => {
  assert(value && !('$ref' in value)); return value;
};

test('settings serialization retains permitted nested configuration in GET and PUT with Swagger on or off', async () => {
  const zotero = { library: { id: 'fixture-library', enabled: true }, collections: ['fixture-collection'] };
  const openalex = { contact: { email: 'fixture@example.invalid' } };
  for (const docs of [false, true]) {
    const { app, projects } = await fixture(docs);
    try {
      const value = new ProjectSettings('p', 'main.typ', { ppi: 144 }, zotero, openalex, date, 7);
      projects.getProjectSettings.execute = async () => value;
      projects.updateProjectSettings.execute = async () => value;
      for (const method of ['GET', 'PUT'] as const) {
        const result = await app.inject({ method, url: '/api/v1/projects/p/settings', headers: { authorization: 'fixture' },
          ...(method === 'PUT' ? { payload: { baseRevision: 7, compileOptions: { ppi: 144 } } } : {}) });
        assert.equal(result.statusCode, 200);
        assert.deepEqual(result.json().settings.compileOptions, { ppi: 144 });
        assert.deepEqual(result.json().settings.zoteroConfig, zotero);
        assert.deepEqual(result.json().settings.openalexConfig, openalex);
      }
    } finally { await app.close(); }
  }
});
const op = (doc: OpenAPIV3.Document, path: string, method: 'get' | 'post' | 'put' | 'patch' | 'delete') => {
  const value = doc.paths[`/api/v1${path}`]?.[method]; assert(value, `${method} ${path}`); return value;
};
const body = (operation: OpenAPIV3.OperationObject, media = 'application/json') => {
  assert(operation.requestBody && !('$ref' in operation.requestBody)); return schema(operation.requestBody.content[media]?.schema);
};
const response = (operation: OpenAPIV3.OperationObject, status = 200) => {
  const value = operation.responses[String(status)]; assert(value && !('$ref' in value)); return value;
};

// Ajv 8 validates Draft 7; preserve the numeric constraint when translating OAS 3.0 boolean bounds.
function forAjv(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(forAjv);
  if (!value || typeof value !== 'object') return value;
  const converted: Record<string, unknown> = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, forAjv(child)]));
  for (const bound of ['Minimum', 'Maximum'] as const) {
    const exclusive = `exclusive${bound}`, inclusive = bound.toLowerCase();
    if (typeof converted[exclusive] !== 'boolean') continue;
    if (converted[exclusive]) {
      assert.equal(typeof converted[inclusive], 'number'); converted[exclusive] = converted[inclusive]; delete converted[inclusive];
    } else delete converted[exclusive];
  }
  return converted;
}

test('Swagger documents all 17 project/file/settings operations, CAS, lifecycle media and literal action paths', async () => {
  const { app } = await fixture(true);
  try {
    const doc = app.swagger() as OpenAPIV3.Document;
    const documented = Object.values(doc.paths).flatMap(path => Object.values(path ?? {}))
      .filter((value): value is OpenAPIV3.OperationObject => !!value && typeof value === 'object' && 'operationId' in value);
    assert.equal(documented.length, 17); assert.equal(new Set(documented.map(value => value.operationId)).size, 17);
    for (const operation of documented) {
      assert.deepEqual(operation.security, [{ bearerAuth: [] }]); assert(operation.description && operation.summary);
      assert(operation.responses['401']); assert(operation.responses['403']);
    }
    const projectGet = schema(response(op(doc, '/projects/{projectId}', 'get')).content?.['application/json']?.schema);
    assert(projectGet.required?.includes('metadataRevision')); assert(projectGet.required?.includes('templateVersionId'));
    assert(schema(projectGet.properties?.access).required?.includes('canRead'));
    for (const [path, method, fields] of [
      ['/projects/{projectId}', 'put', ['baseRevision']],
      ['/projects/{projectId}/settings', 'put', ['baseRevision']],
      ['/projects/{projectId}/files/{*}', 'put', ['content', 'fileId', 'baseRevision']],
      ['/projects/{projectId}/files:rename', 'patch', ['newPath', 'fileId', 'baseRevision']],
    ] as const) {
      const operation = op(doc, path, method);
      assert.deepEqual(new Set(body(operation).required), new Set(fields));
      const revision = schema(body(operation).properties?.baseRevision);
      assert.equal(revision.type, 'integer'); assert.equal(revision.minimum, 0); assert.equal(revision.exclusiveMinimum, true);
      assert(operation.responses['409']); assert(operation.responses['428']);
    }
    const settingsPut = op(doc, '/projects/{projectId}/settings', 'put');
    const ppi = schema(schema(body(settingsPut).properties?.compileOptions).properties?.ppi);
    assert.equal(ppi.minimum, 72); assert.equal(ppi.maximum, 600);
    const settings = schema(schema(response(settingsPut).content?.['application/json']?.schema).properties?.settings);
    assert(settings.required?.includes('revision')); assert.equal(schema(settings.properties?.zoteroConfig).nullable, true);
    const upload = op(doc, '/projects/{projectId}/files:upload', 'post');
    assert.deepEqual(body(upload, 'multipart/form-data').required, ['path', 'file']);
    assert.equal(schema(body(upload, 'multipart/form-data').properties?.file).format, 'binary');
    assert.equal(doc.paths['/api/v1/projects/{projectId}/files{upload}'], undefined);
    assert.equal(doc.paths['/api/v1/projects/{projectId}/files{rename}'], undefined);
    const read = response(op(doc, '/projects/{projectId}/files/{*}', 'get'));
    assert(read.content?.['application/json']); assert.equal(schema(read.content?.['*/*']?.schema).format, 'binary');
    assert(read.headers?.['X-File-Id']); assert(read.headers?.['X-File-Revision']);
    const deletion = op(doc, '/projects/{projectId}/files/{*}', 'delete');
    for (const name of ['fileId', 'baseRevision']) {
      const param = deletion.parameters?.find(value => !('$ref' in value) && value.name === name) as OpenAPIV3.ParameterObject;
      assert.equal(param?.in, 'query'); assert.equal(param?.required, true);
    }
    assert.equal(deletion.requestBody, undefined); assert.equal(response(deletion, 204).content, undefined);
    const exportArchive = op(doc, '/projects/{projectId}/export', 'get');
    assert.equal(schema(response(exportArchive).content?.['application/zip']?.schema).format, 'binary');
    assert(response(exportArchive).headers?.['Content-Disposition']);
    const importArchive = op(doc, '/projects/import', 'post');
    assert.deepEqual(body(importArchive, 'multipart/form-data').required, ['file']);
    const category = importArchive.parameters?.find(value => !('$ref' in value) && value.name === 'category') as OpenAPIV3.ParameterObject;
    assert.deepEqual(schema(category.schema).enum, ['thesis', 'project', 'report', 'proposal', 'paper', 'presentation', 'other']);
    assert(importArchive.responses['413']);
    const duplicate = op(doc, '/projects/{projectId}/duplicate', 'post');
    assert.equal(body(duplicate).required, undefined); assert.equal(body(duplicate).additionalProperties, false);
    assert.equal(body(duplicate).properties?.baseRevision, undefined);
    assert.equal(response(op(doc, '/projects/{projectId}', 'delete'), 204).content, undefined);
    const json = await app.inject('/docs/json'); assert.equal(json.statusCode, 200);
  } finally { await app.close(); }
});

test('lifecycle docs preserve ZIP headers/bytes, archive multipart/query/errors, duplicate input and empty project deletion', async () => {
  const snapshots: unknown[] = [];
  const headers = { authorization: 'test-only-transport-fixture' };
  const boundary = 'fixture-lifecycle-boundary';
  const form = (fileContent: string) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="archive.zip"\r\nContent-Type: application/zip\r\n\r\n${fileContent}\r\n--${boundary}--\r\n`);
  for (const docs of [false, true]) {
    const { app, commands } = await fixture(docs);
    try {
      const doc = docs ? app.swagger() as OpenAPIV3.Document : undefined;
      const duplicate = await app.inject({ method: 'POST', url: '/api/v1/projects/p/duplicate', headers, payload: { title: ' New title ', ignored: 'AJV strips this' } });
      assert.equal(duplicate.statusCode, 201, duplicate.body);
      assert.deepEqual(commands.find(value => value.kind === 'project-duplicate')?.command, { projectId: 'p', userId: 'fixture-user', title: ' New title ' });
      const unnamed = await app.inject({ method: 'POST', url: '/api/v1/projects/p/duplicate', headers, payload: {} });
      assert.equal(unnamed.statusCode, 201);
      const absentBody = await app.inject({ method: 'POST', url: '/api/v1/projects/p/duplicate', headers });
      assert.equal(absentBody.statusCode, 400);
      const zip = await app.inject({ url: '/api/v1/projects/p/export', headers });
      assert.equal(zip.statusCode, 200); assert.equal(zip.headers['content-type'], 'application/zip');
      assert.deepEqual(zip.rawPayload, Buffer.from([80, 75, 3, 4]));
      assert.match(String(zip.headers['content-disposition']), /filename\*=UTF-8''%C4%90%E1%BB%93%20%C3%A1n.zip/);
      const imported = await app.inject({ method: 'POST', url: '/api/v1/projects/import?category=thesis&title=Ti%C3%AAu%20%C4%91%E1%BB%81',
        headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: form('PK') });
      assert.equal(imported.statusCode, 201, imported.body);
      const importCommand = commands.find(value => value.kind === 'project-import')?.command as Record<string, unknown>;
      assert.equal(importCommand.category, 'thesis'); assert.equal(importCommand.title, 'Tiêu đề');
      assert.equal(importCommand.filename, 'archive.zip'); assert.equal(importCommand.archiveBuffer, '504b');
      const badCategory = await app.inject({ method: 'POST', url: '/api/v1/projects/import?category=invalid',
        headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: form('PK') });
      assert.equal(badCategory.statusCode, 400);
      const missing = await app.inject({ method: 'POST', url: '/api/v1/projects/import',
        headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="note"\r\n\r\nno archive\r\n--${boundary}--\r\n`) });
      assert.equal(missing.statusCode, 400); assert.equal(missing.json().error.code, 'MISSING_FILE');
      const oversize = await app.inject({ method: 'POST', url: '/api/v1/projects/import',
        headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: form('x'.repeat(256)) });
      assert.equal(oversize.statusCode, 413); assert.equal(oversize.json().error.code, 'ZIP_PAYLOAD_TOO_LARGE');
      const deleted = await app.inject({ method: 'DELETE', url: '/api/v1/projects/p', headers });
      assert.equal(deleted.statusCode, 204); assert.equal(deleted.body, '');
      const unauthorized = await app.inject({ url: '/api/v1/projects/p/export' }); assert.equal(unauthorized.statusCode, 401);
      if (doc) {
        const ajv = new Ajv({ strict: false, validateFormats: false });
        for (const [result, path, method] of [[duplicate, '/projects/{projectId}/duplicate', 'post'], [imported, '/projects/import', 'post'],
          [missing, '/projects/import', 'post'], [badCategory, '/projects/import', 'post'], [oversize, '/projects/import', 'post']] as const) {
          const validate = ajv.compile(forAjv(schema(response(op(doc, path, method), result.statusCode).content?.['application/json']?.schema)) as object);
          assert(validate(result.json()), JSON.stringify(validate.errors));
        }
      }
      snapshots.push({ duplicate: duplicate.body, unnamed: unnamed.body, absentBody: absentBody.body, zip: zip.body,
        disposition: zip.headers['content-disposition'], imported: imported.body, badCategory: badCategory.body, missing: missing.body,
        oversize: oversize.body, deleted: deleted.body, unauthorized: unauthorized.body, commands });
    } finally { await app.close(); }
  }
  assert.deepEqual(snapshots[0], snapshots[1]);
});

test('CAS documentation leaves transport, existing validators, auth order, multipart, binary headers and empty 204 unchanged', async t => {
  const snapshots: unknown[] = [];
  const headers = { authorization: 'test-only-transport-fixture' };
  const path = '/api/v1/projects/p/files/chapters/ghi%20ch%C3%BA.typ';
  for (const docs of [false, true]) {
    const { app, commands } = await fixture(docs);
    try {
      const doc = docs ? app.swagger() as OpenAPIV3.Document : undefined;
      const ajv = new Ajv({ strict: false, validateFormats: false });
      let validatedResponses = 0;
      const successfulOperations = new Set<string>();
      const cases = [
        { method: 'GET', url: '/api/v1/projects', status: 200 },
        { method: 'GET', url: '/api/v1/projects/p', status: 200 },
        { method: 'POST', url: '/api/v1/projects', payload: { title: ' Fixture ', category: 'thesis', unknown: 'stripped by Zod' }, status: 201 },
        { method: 'PUT', url: '/api/v1/projects/p', payload: { title: 'Changed' }, status: 428 },
        { method: 'PUT', url: '/api/v1/projects/p', payload: { title: 'Changed', baseRevision: 6 }, status: 409 },
        { method: 'PUT', url: '/api/v1/projects/p', payload: { title: 'Changed', baseRevision: 7 }, status: 200 },
        { method: 'GET', url: '/api/v1/projects/p/settings', status: 200 },
        { method: 'PUT', url: '/api/v1/projects/p/settings', payload: { compileOptions: { ppi: 144 } }, status: 428 },
        { method: 'PUT', url: '/api/v1/projects/p/settings', payload: { baseRevision: 6 }, status: 409 },
        { method: 'PUT', url: '/api/v1/projects/p/settings', payload: { baseRevision: 7, compileOptions: { ppi: 144 } }, status: 200 },
        { method: 'PUT', url: '/api/v1/projects/p/settings', payload: { baseRevision: 7, compileOptions: { ppi: 601 } }, status: 400 },
        { method: 'GET', url: '/api/v1/projects/p/files', status: 200 },
        { method: 'POST', url: '/api/v1/projects/p/files', payload: { path: 'new.typ', content: 'Text' }, status: 201 },
        { method: 'GET', url: path, status: 200 },
        { method: 'PUT', url: path, payload: { content: 'Text' }, status: 428 },
        { method: 'PUT', url: path, payload: { content: 'Text', fileId: 'f', baseRevision: 6 }, status: 409 },
        { method: 'PUT', url: path, payload: { content: 'Text', fileId: 'new-id-at-same-path', baseRevision: 7 }, status: 409 },
        { method: 'PUT', url: path, payload: { content: 'Text', fileId: 'f', baseRevision: 7 }, status: 200 },
        { method: 'PATCH', url: '/api/v1/projects/p/files:rename?path=main.typ', payload: { newPath: 'new.typ' }, status: 428 },
        { method: 'PATCH', url: '/api/v1/projects/p/files:rename?path=main.typ', payload: { newPath: 'new.typ', fileId: 'f', baseRevision: 7 }, status: 200 },
        { method: 'DELETE', url: path, status: 428 },
        { method: 'DELETE', url: `${path}?fileId=f&baseRevision=0`, status: 428 },
        { method: 'DELETE', url: `${path}?fileId=f&baseRevision=6`, status: 409 },
        { method: 'DELETE', url: `${path}?fileId=f&baseRevision=7`, status: 204 },
      ] as const;
      const observed: unknown[] = [];
      for (const item of cases) {
        const result = await app.inject({ method: item.method, url: item.url, headers, ...('payload' in item ? { payload: item.payload } : {}) });
        assert.equal(result.statusCode, item.status, `${item.method} ${item.url}: ${result.body}`);
        if (item.status === 204) assert.equal(result.body, '');
        if (doc) {
          const documentPath = item.url.split('?')[0].replace(/^\/api\/v1/, '').replace(/\/projects\/p(?=\/|$)/, '/projects/{projectId}')
            .replace(/\/files\/.+$/, '/files/{*}');
          const operation = op(doc, documentPath, item.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete');
          const documentedResponse = response(operation, item.status);
          if (item.status !== 204) {
            const validate = ajv.compile(forAjv(schema(documentedResponse.content?.['application/json']?.schema)) as object);
            assert(validate(result.json()), `${item.method} ${item.url}: ${JSON.stringify(validate.errors)}`);
            validatedResponses++;
          }
          if (item.status < 300) { assert(operation.operationId); successfulOperations.add(operation.operationId); }
        }
        observed.push({ status: result.statusCode, body: result.body });
      }
      const unauthorized = await app.inject({ method: 'PUT', url: path, payload: { content: 'Text' } });
      assert.equal(unauthorized.statusCode, 401);
      const existingAjvFirst = await app.inject({ method: 'PUT', url: '/api/v1/projects/p/settings', payload: { baseRevision: 7, zoteroConfig: 'invalid object' } });
      assert.equal(existingAjvFirst.statusCode, 400);
      const binary = await app.inject({ url: '/api/v1/projects/p/files/assets/image.png', headers });
      assert.equal(binary.statusCode, 200); assert.deepEqual(binary.rawPayload, Buffer.from([1, 2, 3, 4]));
      assert.equal(binary.headers['content-type'], 'image/png'); assert.equal(binary.headers['x-file-id'], 'binary-file');
      assert.equal(binary.headers['x-file-revision'], '7');
      const boundary = 'fixture-multipart-boundary';
      const upload = await app.inject({ method: 'POST', url: '/api/v1/projects/p/files:upload',
        headers: { ...headers, 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="path"\r\n\r\nassets/image.png\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n1234\r\n--${boundary}--\r\n`) });
      assert.equal(upload.statusCode, 201, upload.body);
      if (doc) {
        const operation = op(doc, '/projects/{projectId}/files:upload', 'post');
        const validate = ajv.compile(forAjv(schema(response(operation, 201).content?.['application/json']?.schema)) as object);
        assert(validate(upload.json()), JSON.stringify(validate.errors));
        validatedResponses++;
        assert(operation.operationId); successfulOperations.add(operation.operationId);
        assert.equal(validatedResponses, 24); assert.equal(successfulOperations.size, 13);
        t.diagnostic(`CAS OpenAPI validated ${validatedResponses} transport-fixture JSON responses, ${successfulOperations.size} successful operations; binary and 204 checked separately.`);
      }
      const deletion = commands.find(value => value.kind === 'file-delete')?.command as { baseRevision: number };
      assert.equal(typeof deletion.baseRevision, 'number');
      const decoded = commands.find(value => value.kind === 'file-get')?.command as { path: string };
      assert.equal(decoded.path, 'chapters/ghi chú.typ');
      snapshots.push({ observed, unauthorized: unauthorized.body, existingAjvFirst: existingAjvFirst.body,
        binary: { body: binary.body, fileId: binary.headers['x-file-id'], revision: binary.headers['x-file-revision'] },
        upload: upload.body, commands });
    } finally { await app.close(); }
  }
  assert.deepEqual(snapshots[0], snapshots[1]);
});
