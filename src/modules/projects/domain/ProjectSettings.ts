export interface CompileOptions {
    ppi?: number;
    [key: string]: unknown;
}

export interface ZoteroConfig {
    [key: string]: unknown;
}

export interface OpenAlexConfig {
    [key: string]: unknown;
}

export class ProjectSettings {
    constructor(
        public readonly projectId: string,
        public readonly mainPath: string,
        public readonly compileOptions: CompileOptions,
        public readonly zoteroConfig: ZoteroConfig | null,
        public readonly openalexConfig: OpenAlexConfig | null,
        public readonly updatedAt: Date,
    ) {}
}
