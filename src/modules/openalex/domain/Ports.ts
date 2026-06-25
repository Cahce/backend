/**
 * OpenAlex Domain Ports
 * 
 * Interfaces for external dependencies.
 * No framework dependencies.
 */

import type { OpenAlexWork, OpenAlexSearchFilters, OpenAlexPaginationMeta, OpenAlexImportStatus } from "./Types.js";

/**
 * OpenAlex API client port
 */
export interface OpenAlexApiPort {
  /**
   * Search for works
   */
  searchWorks(filters: OpenAlexSearchFilters & {
    page?: number;
    perPage?: number;
  }): Promise<{
    works: OpenAlexWork[];
    meta: OpenAlexPaginationMeta;
  }>;

  /**
   * Get a single work by ID
   */
  getWorkById(id: string): Promise<OpenAlexWork>;

  /**
   * Get a single work by DOI (bare form, e.g. "10.1038/nphys1170"). Used as a
   * Docker-free fallback for capture identifier resolution.
   */
  getWorkByDoi(doi: string): Promise<OpenAlexWork>;
}

/**
 * OpenAlex Import Log record
 */
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

/**
 * Input for creating an OpenAlex import log entry.
 */
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

/**
 * OpenAlex Import Log repository port
 */
export interface OpenAlexImportLogRepo {
  /**
   * Create a new import log entry
   */
  create(data: OpenAlexImportLogCreateInput): Promise<OpenAlexImportLogRecord>;

  /**
   * Batch-create import log entries in a single round-trip.
   */
  createMany(rows: OpenAlexImportLogCreateInput[]): Promise<void>;

  /**
   * Find import log by project and OpenAlex ID
   * Returns the first record with status 'imported' if exists
   */
  findByProjectAndOpenAlexId(
    projectId: string,
    openAlexId: string
  ): Promise<OpenAlexImportLogRecord | null>;

  /**
   * Batch lookup: returns all `imported`-status logs for the given OpenAlex IDs
   * in one query (ordered newest-first). Used to dedupe an import batch without
   * issuing one findFirst per ID.
   */
  findImportedByProjectAndOpenAlexIds(
    projectId: string,
    openAlexIds: string[]
  ): Promise<OpenAlexImportLogRecord[]>;

  /**
   * List import logs for a project
   */
  listByProject(
    projectId: string,
    limit?: number
  ): Promise<OpenAlexImportLogRecord[]>;
}
