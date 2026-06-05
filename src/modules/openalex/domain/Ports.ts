/**
 * OpenAlex Domain Ports
 * 
 * Interfaces for external dependencies.
 * No framework dependencies.
 */

import type { OpenAlexWork, OpenAlexSearchFilters, OpenAlexPaginationMeta } from "./Types.js";
import type { OpenAlexImportStatus } from "../../../generated/prisma/index.js";

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
 * OpenAlex Import Log repository port
 */
export interface OpenAlexImportLogRepo {
  /**
   * Create a new import log entry
   */
  create(data: {
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
  }): Promise<OpenAlexImportLogRecord>;

  /**
   * Find import log by project and OpenAlex ID
   * Returns the first record with status 'imported' if exists
   */
  findByProjectAndOpenAlexId(
    projectId: string,
    openAlexId: string
  ): Promise<OpenAlexImportLogRecord | null>;

  /**
   * List import logs for a project
   */
  listByProject(
    projectId: string,
    limit?: number
  ): Promise<OpenAlexImportLogRecord[]>;
}
