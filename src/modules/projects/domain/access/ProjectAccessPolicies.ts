
export interface ProjectAccessPolicy {
  requireProjectAccess(projectId: string, userId: string): Promise<void>;
}

export interface ProjectWriteAccessPolicy {
  requireWriteAccess(projectId: string, userId: string): Promise<void>;
}
