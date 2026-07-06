
export type OpenAlexImportStatus = "imported" | "skipped_duplicate" | "failed";

export interface OpenAlexAuthor {
  author: {
    id: string;
    display_name: string;
    orcid?: string;
  };
  author_position: string;
  institutions: Array<{
    id: string;
    display_name: string;
    country_code?: string;
  }>;
}

export interface OpenAlexWork {
  id: string;
  doi?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  publication_date?: string;
  type?: string;
  
  authorships?: OpenAlexAuthor[];
  
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
  
  biblio?: {
    volume?: string;
    issue?: string;
    first_page?: string;
    last_page?: string;
  };
  
  open_access?: {
    is_oa?: boolean;
    oa_status?: string;
    oa_url?: string;
    any_repository_has_fulltext?: boolean;
  };
  
  abstract_inverted_index?: Record<string, number[]>;
  
  cited_by_count?: number;
  
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

export interface OpenAlexPaginationMeta {
  count: number;
  db_response_time_ms: number;
  page: number;
  per_page: number;
}

export interface OpenAlexSearchFilters {
  search?: string;
  yearFrom?: number;
  yearTo?: number;
  isOA?: boolean;
  type?: string;
}
