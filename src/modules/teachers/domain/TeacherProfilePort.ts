import type { TeacherProfile } from "./TeacherProfile.js";

export interface TeacherProfilePort {
  findByAccountId(accountId: string): Promise<TeacherProfile | null>;
}
