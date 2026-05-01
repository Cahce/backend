import type { TeacherProfile } from "./TeacherProfile.js";

/**
 * Port interface for Teacher Profile repository
 */
export interface TeacherProfilePort {
  findByAccountId(accountId: string): Promise<TeacherProfile | null>;
}
