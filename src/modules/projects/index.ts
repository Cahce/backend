/**
 * Projects Module Public API
 * 
 * Exports use cases, domain types, and errors for external consumption.
 * Does NOT export infra implementations or delivery layer code.
 */

// Domain exports
export type { Project, CreateProjectData, UpdateProjectData } from './domain/Project/Types.js';
export { TemplateCategory } from './domain/Project/Types.js';
export type { ProjectRepo } from './domain/Project/Ports.js';
export { ProjectErrors } from './domain/Project/Errors.js';
export type { AuthContext } from './domain/Project/Policies.js';
export { ProjectAuthPolicy } from './domain/Project/Policies.js';

// Application exports
export type { Result } from './application/Types.js';
export { success, failure } from './application/Types.js';
export { CreateProjectUseCase } from './application/CreateProjectUseCase.js';
export { GetProjectUseCase } from './application/GetProjectUseCase.js';
export { ListProjectsUseCase } from './application/ListProjectsUseCase.js';
export { UpdateProjectUseCase } from './application/UpdateProjectUseCase.js';
export { DeleteProjectUseCase } from './application/DeleteProjectUseCase.js';

// Container export
export { ProjectsContainer } from './Container.js';
