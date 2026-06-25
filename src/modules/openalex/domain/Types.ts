/**
 * OpenAlex Domain Types
 *
 * Raw API shapes from OpenAlex API.
 * No framework dependencies.
 */

/**
 * Import status for an OpenAlex → bibliography import attempt.
 *
 * Domain-owned union (NOT the Prisma-generated enum) so the domain layer stays
 * free of framework imports. The infra repository maps this to/from the Prisma
 * `OpenAlexImportStatus` enum at the persistence boundary.
 */
export type OpenAlexImportStatus = "imported" | "skipped_duplicate" | "failed";

/**
 * OpenAlex Author
 */
export interface OpenAlexAuthor {
  author: {
    id: string;
    display_name: string;
    orcid?: string;
  };
  author_position: string; // "first", "middle", "last"
  institutions: Array<{
    id: string;
    display_name: string;
    country_code?: string;
  }>;
}

/**
 * OpenAlex Work (raw API shape)
 */
export interface OpenAlexWork {
  id: string; // "W12345"
  doi?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  publication_date?: string;
  type?: string; // "journal-article", "book", etc.
  
  // Authors
  authorships?: OpenAlexAuthor[];
  
  // Publication venue
  primary_location?: {
    source?: {
      id?: string;
      display_name?: string;
      issn_l?: string;
      issn?: string[];
      host_organization?: string;
      host_organization_name?: string;
      type?: string;
    };
    landing_page_url?: string;
    pdf_url?: string;
    is_oa?: boolean;
    version?: string;
    license?: string;
  };
  
  // Bibliographic info
  biblio?: {
    volume?: string;
    issue?: string;
    first_page?: string;
    last_page?: string;
  };
  
  // Open access
  open_access?: {
    is_oa?: boolean;
    oa_status?: string;
    oa_url?: string;
    any_repository_has_fulltext?: boolean;
  };
  
  // Abstract
  abstract_inverted_index?: Record<string, number[]>;
  
  // Metrics
  cited_by_count?: number;
  
  // Other metadata
  language?: string;
  keywords?: Array<{
    keyword: string;
    score: number;
  }>;
  concepts?: Array<{
    id: string;
    wikidata: string;
    display_name: string;
    level: number;
    score: number;
  }>;
}

/**
 * OpenAlex API pagination metadata
 */
export interface OpenAlexPaginationMeta {
  count: number;
  db_response_time_ms: number;
  page: number;
  per_page: number;
}

/**
 * OpenAlex search filters
 */
export interface OpenAlexSearchFilters {
  search?: string;
  yearFrom?: number;
  yearTo?: number;
  isOA?: boolean;
  type?: string;
}
