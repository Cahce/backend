
import type { OpenAlexWork, OpenAlexSearchFilters, OpenAlexPaginationMeta, OpenAlexImportStatus } from "./Types.js";

export interface OpenAlexApiPort {
  searchWorks(filters: OpenAlexSearchFilters & {
    page?: number;
    perPage?: number;
  }): Promise<{
    works: OpenAlexWork[];
    meta: OpenAlexPaginationMeta;
  }>;

  getWorkById(id: string): Promise<OpenAlexWork>;

  getWorkByDoi(doi: string): Promise<OpenAlexWork>;
}

export interface OpenAlexImportLogRecord {
  id: string;
  userId: string;
  projectId: string;
  openAlexId: string;
  citationKey: string;
  targetBibPath: string;
  doi: string | null;
  title: string | null;
  year: number | null;
  status: OpenAlexImportStatus;
  errorMessage: string | null;
  importedAt: Date;
}

export interface OpenAlexImportLogCreateInput {
  userId: string;
  projectId: string;
  openAlexId: string;
  citationKey: string;
  targetBibPath: string;
  doi?: string | null;
  title?: string | null;
  year?: number | null;
  status: OpenAlexImportStatus;
  errorMessage?: string | null;
}

export interface OpenAlexImportLogRepo {
  create(data: OpenAlexImportLogCreateInput): Promise<OpenAlexImportLogRecord>;

  createMany(rows: OpenAlexImportLogCreateInput[]): Promise<void>;

  findByProjectAndOpenAlexId(
    projectId: string,
    openAlexId: string
  ): Promise<OpenAlexImportLogRecord | null>;

  findImportedByProjectAndOpenAlexIds(
    projectId: string,
    openAlexIds: string[]
  ): Promise<OpenAlexImportLogRecord[]>;

  listByProject(
    projectId: string,
    limit?: number
  ): Promise<OpenAlexImportLogRecord[]>;
}
