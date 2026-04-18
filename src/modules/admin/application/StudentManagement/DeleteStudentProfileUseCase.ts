// Use case for deleting a student profile
// No framework dependencies

import type { Result } from '../Types.js';
import type { StudentProfileRepo } from '../../domain/StudentManagement/Ports.js';
import { StudentErrors } from '../../domain/StudentManagement/Errors.js';

export class DeleteStudentProfileUseCase {
  constructor(private readonly studentRepo: StudentProfileRepo) {}

  async execute(id: string): Promise<Result<void>> {
    // Check if student exists
    const student = await this.studentRepo.findById(id);
    if (!student) {
      return {
        success: false,
        error: StudentErrors.STUDENT_NOT_FOUND
      };
    }

    // Delete student profile
    await this.studentRepo.delete(id);

    return {
      success: true,
      data: undefined
    };
  }
}
