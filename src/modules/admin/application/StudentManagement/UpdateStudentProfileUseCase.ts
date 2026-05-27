// Use case for updating a student profile
// No framework dependencies

import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';
import type { StudentProfile, UpdateStudentData } from '../../domain/StudentManagement/Types.js';
import type { StudentProfileRepo } from '../../domain/StudentManagement/Ports.js';
import type { ClassRepo } from '../../domain/Class/Ports.js';
import { StudentPolicy } from '../../domain/StudentManagement/Policies.js';
import { StudentErrors } from '../../domain/StudentManagement/Errors.js';

export class UpdateStudentProfileUseCase {
  constructor(
    private readonly studentRepo: StudentProfileRepo,
    private readonly classRepo: ClassRepo
  ) {}

  async execute(id: string, data: UpdateStudentData): Promise<Result<StudentProfile>> {
    const existing = await this.studentRepo.findById(id);
    if (!existing) {
      return failure(StudentErrors.STUDENT_NOT_FOUND.code, StudentErrors.STUDENT_NOT_FOUND.message);
    }

    if (data.studentCode !== undefined) {
      const codeValidation = StudentPolicy.validateStudentCode(data.studentCode);
      if (!codeValidation.success) {
        return codeValidation;
      }

      const duplicate = await this.studentRepo.findByStudentCode(data.studentCode);
      if (duplicate && duplicate.id !== id) {
        return failure(
          StudentErrors.DUPLICATE_STUDENT_CODE.code,
          StudentErrors.DUPLICATE_STUDENT_CODE.message
        );
      }
    }

    if (data.fullName !== undefined) {
      const nameValidation = StudentPolicy.validateFullName(data.fullName);
      if (!nameValidation.success) {
        return nameValidation;
      }
    }

    if (data.classId !== undefined) {
      const academicClass = await this.classRepo.findById(data.classId);
      if (!academicClass) {
        return failure(
          StudentErrors.CLASS_NOT_FOUND.code,
          StudentErrors.CLASS_NOT_FOUND.message
        );
      }
    }

    try {
      const updated = await this.studentRepo.update(id, data);
      return success(updated);
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        return failure(
          StudentErrors.DUPLICATE_STUDENT_CODE.code,
          StudentErrors.DUPLICATE_STUDENT_CODE.message
        );
      }
      throw error;
    }
  }
}
