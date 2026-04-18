/**
 * Project Files Module Public API
 * 
 * Exports use cases, domain types, and errors for external consumption.
 * Does NOT export infra implementations or delivery layer code.
 */

// Domain exports
export type { File, FileMetadata, CreateFileData, UpdateFileData, RenameFileData } from './domain/ProjectFile/Types.js';
export { FileKind, StorageMode } from './domain/ProjectFile/Types.js';
export type { FileRepo } from './domain/ProjectFile/Ports.js';
export { FileErrors } from './domain/ProjectFile/Errors.js';
export { StoragePolicy } from './domain/ProjectFile/Policies.js';

// Application exports
export type { Result } from './application/Types.js';
export { success, failure } from './application/Types.js';
export { ListFilesUseCase } from './application/ListFilesUseCase.js';
export { GetFileUseCase } from './application/GetFileUseCase.js';
export { CreateFileUseCase } from './application/CreateFileUseCase.js';
export { UpdateFileUseCase } from './application/UpdateFileUseCase.js';
export { RenameFileUseCase } from './application/RenameFileUseCase.js';
export { DeleteFileUseCase } from './application/DeleteFileUseCase.js';
export { GetFilesForCompilationUseCase } from './application/GetFilesForCompilationUseCase.js';
export { CreateFilesFromTemplateUseCase } from './application/CreateFilesFromTemplateUseCase.js';

// Container export
export { ProjectFilesContainer } from './Container.js';
