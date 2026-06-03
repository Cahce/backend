/**
 * In-memory mock of AdminProjectRepo for use-case unit tests.
 * Captures the last filters/role so tests can assert pass-through.
 */

import type {
  AdminProjectRepo,
  AdminProjectFilters,
  AdminProjectListResult,
  AdminProjectDetailRow,
  AdminProjectStats,
  ProjectOwnerRole,
} from '../../domain/Project/AdminProjectPorts.js';

export class MockAdminProjectRepo implements AdminProjectRepo {
  public lastFilters: AdminProjectFilters | null = null;
  public lastStatsRole: ProjectOwnerRole | undefined = undefined;

  private listResult: AdminProjectListResult = { items: [], total: 0 };
  private detail: AdminProjectDetailRow | null = null;
  private statsResult: AdminProjectStats = {
    total: 0,
    byRole: { student: 0, teacher: 0 },
    byCategory: {
      thesis: 0,
      report: 0,
      proposal: 0,
      paper: 0,
      presentation: 0,
      other: 0,
    },
  };

  setListResult(result: AdminProjectListResult): void {
    this.listResult = result;
  }

  setDetail(detail: AdminProjectDetailRow | null): void {
    this.detail = detail;
  }

  setStats(stats: AdminProjectStats): void {
    this.statsResult = stats;
  }

  async listForAdmin(filters: AdminProjectFilters): Promise<AdminProjectListResult> {
    this.lastFilters = filters;
    return this.listResult;
  }

  async getDetailForAdmin(_projectId: string): Promise<AdminProjectDetailRow | null> {
    return this.detail;
  }

  async stats(ownerRole?: ProjectOwnerRole): Promise<AdminProjectStats> {
    this.lastStatsRole = ownerRole;
    return this.statsResult;
  }
}
