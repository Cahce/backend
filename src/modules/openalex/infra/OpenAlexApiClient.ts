/**
 * OpenAlex API Client
 * 
 * Infrastructure adapter for OpenAlex API communication.
 */

import type { OpenAlexApiPort } from "../domain/Ports.js";
import type { OpenAlexWork, OpenAlexSearchFilters, OpenAlexPaginationMeta } from "../domain/Types.js";
import {
  OpenAlexNotFoundError,
  OpenAlexRateLimitError,
  OpenAlexUpstreamError,
  OpenAlexTimeoutError,
} from "../domain/Errors.js";

/**
 * Configuration for OpenAlexApiClient
 */
export interface OpenAlexApiClientConfig {
  baseUrl?: string;
  mailto?: string;
  timeout?: number;
}

/**
 * OpenAlex API Client implementation
 */
export class OpenAlexApiClient implements OpenAlexApiPort {
  private readonly baseUrl: string;
  private readonly mailto: string;
  private readonly timeout: number;

  constructor(config: OpenAlexApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || "https://api.openalex.org";
    this.mailto = config.mailto || "";
    this.timeout = config.timeout || 10000; // 10 seconds
  }

  /**
   * Search for works
   */
  async searchWorks(filters: OpenAlexSearchFilters & {
    page?: number;
    perPage?: number;
  }): Promise<{
    works: OpenAlexWork[];
    meta: OpenAlexPaginationMeta;
  }> {
    const { search, yearFrom, yearTo, isOA, type, page = 1, perPage = 25 } = filters;

    // Build filter string
    const filterParts: string[] = [];

    if (yearFrom || yearTo) {
      const from = yearFrom || 1500;
      const to = yearTo || new Date().getFullYear();
      filterParts.push(`publication_year:${from}-${to}`);
    }

    if (isOA !== undefined) {
      filterParts.push(`is_oa:${isOA}`);
    }

    if (type) {
      filterParts.push(`type:${type}`);
    }

    // Build URL
    const params = new URLSearchParams();
    
    if (search) {
      params.append("search", search);
    }

    if (filterParts.length > 0) {
      params.append("filter", filterParts.join(","));
    }

    params.append("page", page.toString());
    params.append("per_page", perPage.toString());

    // Add polite mode if mailto is provided
    if (this.mailto) {
      params.append("mailto", this.mailto);
    }

    const url = `${this.baseUrl}/works?${params.toString()}`;

    try {
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json() as any;

      return {
        works: data.results || [],
        meta: data.meta || {
          count: 0,
          db_response_time_ms: 0,
          page: 1,
          per_page: perPage,
        },
      };
    } catch (error) {
      if (
        error instanceof OpenAlexNotFoundError ||
        error instanceof OpenAlexRateLimitError ||
        error instanceof OpenAlexTimeoutError
      ) {
        throw error;
      }
      throw new OpenAlexUpstreamError(`Không thể tìm kiếm work: ${(error as Error).message}`);
    }
  }

  /**
   * Get a single work by ID
   */
  async getWorkById(id: string): Promise<OpenAlexWork> {
    // OpenAlex IDs can be in format "W12345" or full URL
    const workId = id.startsWith("W") ? id : `W${id}`;
    const url = `${this.baseUrl}/works/${workId}`;

    try {
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json() as OpenAlexWork;
      return data;
    } catch (error) {
      if (
        error instanceof OpenAlexNotFoundError ||
        error instanceof OpenAlexRateLimitError ||
        error instanceof OpenAlexTimeoutError
      ) {
        throw error;
      }
      throw new OpenAlexUpstreamError(`Không thể lấy work: ${(error as Error).message}`);
    }
  }

  /**
   * Get a single work by DOI. Accepts bare DOI, `doi:` prefix, or a doi.org URL.
   */
  async getWorkByDoi(doi: string): Promise<OpenAlexWork> {
    const clean = doi
      .trim()
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
      .replace(/^doi:\s*/i, "");

    const params = new URLSearchParams();
    if (this.mailto) {
      params.append("mailto", this.mailto);
    }
    const qs = params.toString();
    const url = `${this.baseUrl}/works/doi:${encodeURIComponent(clean)}${qs ? `?${qs}` : ""}`;

    try {
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      return (await response.json()) as OpenAlexWork;
    } catch (error) {
      if (
        error instanceof OpenAlexNotFoundError ||
        error instanceof OpenAlexRateLimitError ||
        error instanceof OpenAlexTimeoutError
      ) {
        throw error;
      }
      throw new OpenAlexUpstreamError(
        `Không thể lấy work theo DOI: ${(error as Error).message}`
      );
    }
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "TypstScholarBackend/1.0",
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === "AbortError") {
        throw new OpenAlexTimeoutError();
      }

      throw error;
    }
  }

  /**
   * Handle error responses from OpenAlex API
   */
  private async handleErrorResponse(response: Response): Promise<Error> {
    const status = response.status;

    if (status === 404) {
      return new OpenAlexNotFoundError();
    }

    if (status === 429) {
      return new OpenAlexRateLimitError();
    }

    // Try to get error message from response
    let message = `OpenAlex API error: ${status}`;
    try {
      const data = await response.json() as any;
      if (data.message) {
        message = data.message;
      }
    } catch {
      // Ignore JSON parse errors
    }

    return new OpenAlexUpstreamError(message);
  }
}
