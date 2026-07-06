
export interface ZoteroCreator {
  creatorType: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

export interface ZoteroItem {
  key: string;
  version: number;
  itemType: string;
  
  title?: string;
  creators?: ZoteroCreator[];
  date?: string;
  
  publicationTitle?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  DOI?: string;
  ISSN?: string;
  
  publisher?: string;
  place?: string;
  edition?: string;
  numPages?: string;
  ISBN?: string;
  
  proceedingsTitle?: string;
  conferenceName?: string;
  
  university?: string;
  thesisType?: string;
  
  institution?: string;
  reportNumber?: string;
  reportType?: string;
  
  url?: string;
  accessDate?: string;
  websiteTitle?: string;
  
  abstractNote?: string;
  language?: string;
  rights?: string;
  extra?: string;
  tags?: Array<{ tag: string }>;
  collections?: string[];
  relations?: Record<string, unknown>;
}

export interface ZoteroCollection {
  key: string;
  version: number;
  name: string;
  parentCollection?: string | false;
  
  data?: {
    key: string;
    version: number;
    name: string;
    parentCollection?: string | false;
  };
  
  relations?: Record<string, unknown>;
}

export interface ZoteroPaginationMeta {
  total: number;
  start: number;
  limit: number;
}

export interface ZoteroConnectionRecord {
  id: string;
  userId: string;
  accessToken: string;
  libraryId: string;
  libraryType: "user" | "group";
  connectedAt: Date;
  lastSyncedAt: Date | null;
}

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
