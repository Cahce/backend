/**
 * Search Works Use Case
 * 
 * Searches for academic works on OpenAlex.
 */

import type { OpenAlexApiPort } from "../domain/Ports.js";
import type { OpenAlexWork, OpenAlexSearchFilters } from "../domain/Types.js";

/**
 * Command to search works
 */
export interface SearchWorksCommand extends OpenAlexSearchFilters {
  page?: number;
  perPage?: number;
}

/**
 * Result of searching works
 */
export interface SearchWorksResult {
  works: OpenAlexWork[];
  total: number;
  page: number;
  perPage: number;
}

/**
 * Search Works Use Case
 */
export class SearchWorks {
  constructor(private readonly apiClient: OpenAlexApiPort) {}

  async execute(command: SearchWorksCommand): Promise<SearchWorksResult> {
    const result = await this.apiClient.searchWorks(command);

    return {
      works: result.works,
      total: result.meta.count,
      page: result.meta.page,
      perPage: result.meta.per_page,
    };
  }
}
