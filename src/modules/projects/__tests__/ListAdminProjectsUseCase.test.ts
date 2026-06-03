/**
 * Unit Tests for ListAdminProjectsUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ListAdminProjectsUseCase } from '../application/ListAdminProjectsUseCase.js';
import { MockAdminProjectRepo } from './mocks/MockAdminProjectRepo.js';
import type { AdminProjectFilters, AdminProjectRow } from '../domain/Project/AdminProjectPorts.js';

function baseFilters(overrides: Partial<AdminProjectFilters> = {}): AdminProjectFilters {
  return {
    sort: 'updatedAt',
    order: 'desc',
    page: 1,
    pageSize: 20,
    ...overrides,
  };
}

function sampleRow(): AdminProjectRow {
  return {
    id: 'p1',
    title: 'Luận văn A',
    category: 'thesis',
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-02-02T03:04:05.000Z'),
    lastEditedAt: null,
    fileCount: 3,
    hasPdf: true,
    owner: {
      userId: 'u1',
      email: 'sv@e.tlu.edu.vn',
      role: 'student',
      isActive: true,
      displayName: 'Nguyễn Văn A',
      code: 'SV001',
      faculty: { id: 'f1', name: 'CNTT', code: 'IT' },
      unit: 'Lớp 62TH1 · KHMT',
    },
  };
}

describe('ListAdminProjectsUseCase', () => {
  let repo: MockAdminProjectRepo;
  let useCase: ListAdminProjectsUseCase;

  beforeEach(() => {
    repo = new MockAdminProjectRepo();
    useCase = new ListAdminProjectsUseCase(repo);
  });

  it('passes filters through to the repo', async () => {
    const filters = baseFilters({
      ownerRole: 'student',
      category: 'thesis',
      search: 'Nguyễn',
      createdFrom: new Date('2026-01-01T00:00:00.000Z'),
      createdTo: new Date('2026-03-01T00:00:00.000Z'),
    });

    await useCase.execute(filters);

    assert.deepStrictEqual(repo.lastFilters, filters);
  });

  it('maps rows to ISO DTOs and computes pagination', async () => {
    repo.setListResult({ items: [sampleRow()], total: 25 });

    const result = await useCase.execute(baseFilters({ page: 2, pageSize: 10 }));

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.total, 25);
      assert.strictEqual(result.data.page, 2);
      assert.strictEqual(result.data.pageSize, 10);
      assert.strictEqual(result.data.totalPages, 3); // ceil(25/10)
      assert.strictEqual(result.data.items.length, 1);
      const item = result.data.items[0];
      assert.strictEqual(item.createdAt, '2026-01-02T03:04:05.000Z');
      assert.strictEqual(item.updatedAt, '2026-02-02T03:04:05.000Z');
      assert.strictEqual(item.lastEditedAt, null);
      assert.strictEqual(item.hasPdf, true);
      assert.strictEqual(item.owner?.displayName, 'Nguyễn Văn A');
      assert.strictEqual(item.owner?.code, 'SV001');
    }
  });

  it('returns an empty page when there are no projects', async () => {
    repo.setListResult({ items: [], total: 0 });

    const result = await useCase.execute(baseFilters());

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.items.length, 0);
      assert.strictEqual(result.data.totalPages, 0);
    }
  });
});
