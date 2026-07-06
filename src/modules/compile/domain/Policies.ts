
export interface OfficialCompileAccessPolicy {
  requireOfficialCompileAccess(
    projectId: string,
    userId: string,
    userRole: 'admin' | 'teacher' | 'student',
  ): Promise<void>;
}
