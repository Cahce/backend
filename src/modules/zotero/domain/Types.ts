/**
 * Zotero Domain Types
 * 
 * Raw API shapes from Zotero API.
 * No framework dependencies.
 */

/**
 * Zotero creator (author, editor, etc.)
 */
export interface ZoteroCreator {
  creatorType: string;  // "author", "editor", "contributor", etc.
  firstName?: string;
  lastName?: string;
  name?: string;  // For organizations
}

/**
 * Zotero item (raw API shape)
 */
export interface ZoteroItem {
  key: string;
  version: number;
  itemType: string;  // "journalArticle", "book", "conferencePaper", etc.
  
  // Common fields
  title?: string;
  creators?: ZoteroCreator[];
  date?: string;
  
  // Article fields
  publicationTitle?: string;  // Journal name
  volume?: string;
  issue?: string;
  pages?: string;
  DOI?: string;
  ISSN?: string;
  
  // Book fields
  publisher?: string;
  place?: string;
  edition?: string;
  numPages?: string;
  ISBN?: string;
  
  // Conference fields
  proceedingsTitle?: string;
  conferenceName?: string;
  
  // Thesis fields
  university?: string;
  thesisType?: string;
  
  // Report fields
  institution?: string;
  reportNumber?: string;
  reportType?: string;
  
  // Web fields
  url?: string;
  accessDate?: string;
  websiteTitle?: string;
  
  // Other fields
  abstractNote?: string;
  language?: string;
  rights?: string;
  extra?: string;
  tags?: Array<{ tag: string }>;
  collections?: string[];
  relations?: Record<string, unknown>;
}

/**
 * Zotero collection
 */
export interface ZoteroCollection {
  key: string;
  version: number;
  name: string;
  parentCollection?: string | false;  // false means top-level
  
  // Metadata
  data?: {
    key: string;
    version: number;
    name: string;
    parentCollection?: string | false;
  };
  
  // Relations
  relations?: Record<string, unknown>;
}

/**
 * Zotero API pagination metadata
 */
export interface ZoteroPaginationMeta {
  total: number;
  start: number;
  limit: number;
}

/**
 * Zotero connection record (domain representation)
 */
export interface ZoteroConnectionRecord {
  id: string;
  userId: string;
  accessToken: string;  // Decrypted
  libraryId: string;
  libraryType: "user" | "group";
  connectedAt: Date;
  lastSyncedAt: Date | null;
}

/**
 * Zotero sync log record (domain representation)
 */
export interface ZoteroSyncLogRecord {
  id: string;
  connectionId: string;
  projectId: string | null;
  syncType: "full" | "incremental";
  status: "pending" | "running" | "success" | "failed";
  itemsSynced: number;
  errorMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}
