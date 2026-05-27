/**
 * MaterializeTemplate Port
 * 
 * Cross-module interface for materializing template version files.
 * This is implemented by the templates module and injected into projects module.
 */

export type MaterializedFile = {
  path: string;
  content: string;
};

/**
 * Result of template materialization
 */
export type MaterializeTemplateResult = {
  files: MaterializedFile[];
  entryPath: string;
};

/**
 * MaterializeTemplate function type
 * 
 * Used by projects module to materialize template version files.
 * Returns both the materialized files and the entry path from the template version.
 * Throws error with code 'INVALID_TEMPLATE_VERSION' if version is not found or not active.
 */
export type MaterializeTemplate = (versionId: string) => Promise<MaterializeTemplateResult>;
