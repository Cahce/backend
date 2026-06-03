/**
 * Unit Tests for GetAdminProjectStatsUseCase
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GetAdminProjectStatsUseCase } from '../application/GetAdminProjectStatsUseCase.js';
import { MockAdminProjectRepo } from './mocks/MockAdminProjectRepo.js';

describe('GetAdminProjectStatsUseCase', () => {
  let repo: MockAdminProjectRepo;
  let useCase: GetAdminProjectStatsUseCase;

  beforeEach(() => {
    repo = new MockAdminProjectRepo();
    useCase = new GetAdminProjectStatsUseCase(repo);
  });

  it('forwards the ownerRole scope to the repo', async () => {
    await useCase.execute('teacher');
    assert.strictEqual(repo.lastStatsRole, 'teacher');
  });

  it('returns the aggregate stats', async () => {
    repo.setStats({
      total: 12,
      byRole: { student: 8, teacher: 4 },
      byCategory: {
        thesis: 5,
        report: 3,
        proposal: 1,
        paper: 1,
        presentation: 0,
        other: 2,
      },
    });

    const result = await useCase.execute();

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.total, 12);
      assert.strictEqual(result.data.byRole.student, 8);
      assert.strictEqual(result.data.byRole.teacher, 4);
      assert.strictEqual(result.data.byCategory.thesis, 5);
      assert.strictEqual(result.data.byCategory.other, 2);
    }
  });
});
