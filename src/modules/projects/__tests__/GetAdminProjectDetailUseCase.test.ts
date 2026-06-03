/**
 * Unit Tests for GetAdminProjectDetailUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GetAdminProjectDetailUseCase } from '../application/GetAdminProjectDetailUseCase.js';
import { MockAdminProjectRepo } from './mocks/MockAdminProjectRepo.js';
import type { AdminProjectDetailRow } from '../domain/Project/AdminProjectPorts.js';

function detailRow(): AdminProjectDetailRow {
  return {
    id: 'p1',
    title: 'Báo cáo',
    category: 'report',
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-02-02T03:04:05.000Z'),
    lastEditedAt: new Date('2026-02-03T00:00:00.000Z'),
    fileCount: 2,
    hasPdf: true,
    owner: null, // orphan project — must not crash
    mainPath: 'main.typ',
    totalSizeBytes: 1234,
    latestArtifact: {
      id: 'a1',
      createdAt: new Date('2026-02-02T10:00:00.000Z'),
      sizeBytes: 999,
    },
    files: [
      { path: 'main.typ', kind: 'typst', sizeBytes: 100, updatedAt: new Date('2026-02-01T00:00:00.000Z') },
      { path: 'refs.bib', kind: 'bib', sizeBytes: null, updatedAt: new Date('2026-02-01T00:00:00.000Z') },
    ],
  };
}

describe('GetAdminProjectDetailUseCase', () => {
  let repo: MockAdminProjectRepo;
  let useCase: GetAdminProjectDetailUseCase;

  beforeEach(() => {
    repo = new MockAdminProjectRepo();
    useCase = new GetAdminProjectDetailUseCase(repo);
  });

  it('returns PROJECT_NOT_FOUND when the project does not exist', async () => {
    repo.setDetail(null);

    const result = await useCase.execute('missing');

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.error.code, 'PROJECT_NOT_FOUND');
    }
  });

  it('maps the detail row to an ISO DTO and tolerates a null owner', async () => {
    repo.setDetail(detailRow());

    const result = await useCase.execute('p1');

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.owner, null);
      assert.strictEqual(result.data.mainPath, 'main.typ');
      assert.strictEqual(result.data.totalSizeBytes, 1234);
      assert.strictEqual(result.data.lastEditedAt, '2026-02-03T00:00:00.000Z');
      assert.strictEqual(result.data.latestArtifact?.createdAt, '2026-02-02T10:00:00.000Z');
      assert.strictEqual(result.data.files.length, 2);
      assert.strictEqual(result.data.files[0].updatedAt, '2026-02-01T00:00:00.000Z');
      assert.strictEqual(result.data.files[1].sizeBytes, null);
    }
  });
});
