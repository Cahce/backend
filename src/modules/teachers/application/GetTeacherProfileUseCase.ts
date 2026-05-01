import type { TeacherProfile } from "../domain/TeacherProfile.js";
import type { TeacherProfilePort } from "../domain/TeacherProfilePort.js";

/**
 * Use case: Get authenticated teacher's profile
 */
export class GetTeacherProfileUseCase {
  constructor(private readonly repository: TeacherProfilePort) {}

  async execute(accountId: string): Promise<TeacherProfile | null> {
    return this.repository.findByAccountId(accountId);
  }
}
