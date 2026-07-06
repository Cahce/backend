
export type MaterializedFile = {
  path: string;
  content: string;
  data?: Buffer;
};

export type MaterializeTemplateResult = {
  files: MaterializedFile[];
  entryPath: string;
};

export type MaterializeTemplate = (versionId: string) => Promise<MaterializeTemplateResult>;
