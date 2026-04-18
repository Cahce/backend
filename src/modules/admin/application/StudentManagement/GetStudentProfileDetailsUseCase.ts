// Use case for getting student profile details by ID
// No framework dependencies

import type { Result } from '../Types.js';
import type { StudentProfileWithContext } from '../../domain/StudentManagement/Types.js';
import type { StudentProfileRepo } from '../../domain/StudentManagement/Ports.js';
import { StudentErrors } from '../../domain/StudentManagement/Errors.js';

export class GetStudentProfileDetailsUseCase {
  constructor(private readonly studentRepo: StudentProfileRepo) {}

  async execute(id: string): Promise<Result<StudentProfileWithContext>> {
    const student = await this.studentRepo.findById(id);

    if (!student) {
      return {
        success: false,
        error: StudentErrors.STUDENT_NOT_FOUND
      };
    }

    return {
      success: true,
      data: student
    };
  }
}
