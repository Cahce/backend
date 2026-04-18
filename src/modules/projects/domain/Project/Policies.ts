/**
 * Project Authorization Policy
 * 
 * Domain-level authorization policies for Project operations.
 * No framework dependencies.
 */

import type { Project } from './Types.js';

/**
 * Authentication context containing user identity and role
 */
export interface AuthContext {
  userId: string;
  role: 'admin' | 'teacher' | 'student';
}

/**
 * Project authorization policy
 * 
 * Defines authorization rules for Project operations.
 * Rules:
 * - Owner can read, write, and delete their own projects
 * - Admin can read, write, and delete all projects
 */
export class ProjectAuthPolicy {
  /**
   * Check if user can read a project
   * @param project - Project entity
   * @param auth - Authentication context
   * @returns True if user can read the project
   */
  static canRead(project: Project, auth: AuthContext): boolean {
    if (auth.role === 'admin') {
      return true;
    }
    return project.ownerId === auth.userId;
  }

  /**
   * Check if user can write (update) a project
   * @param project - Project entity
   * @param auth - Authentication context
   * @returns True if user can write to the project
   */
  static canWrite(project: Project, auth: AuthContext): boolean {
    if (auth.role === 'admin') {
      return true;
    }
    return project.ownerId === auth.userId;
  }

  /**
   * Check if user can delete a project
   * @param project - Project entity
   * @param auth - Authentication context
   * @returns True if user can delete the project
   */
  static canDelete(project: Project, auth: AuthContext): boolean {
    if (auth.role === 'admin') {
      return true;
    }
    return project.ownerId === auth.userId;
  }
}
