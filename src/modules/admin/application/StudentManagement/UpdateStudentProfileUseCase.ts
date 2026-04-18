// Use case for updating a student profile
// No framework dependencies

import type { Result } from '../Types.js';
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
    // Check if student exists
    const existing = await this.studentRepo.findById(id);
    if (!existing) {
      return {
        success: false,
        error: StudentErrors.STUDENT_NOT_FOUND
      };
    }

    // Validate student code if being updated
    if (data.studentCode !== undefined) {
      const codeValidation = StudentPolicy.validateStudentCode(data.studentCode);
      if (!codeValidation.success) {
        return codeValidation;
      }

      // Check for duplicate student code (excluding current student)
      const duplicate = await this.studentRepo.findByStudentCode(data.studentCode);
      if (duplicate && duplicate.id !== id) {
        return {
          success: false,
          error: StudentErrors.DUPLICATE_STUDENT_CODE
        };
      }
    }

    // Validate full name if being updated
    if (data.fullName !== undefined) {
      const nameValidation = StudentPolicy.validateFullName(data.fullName);
      if (!nameValidation.success) {
        return nameValidation;
      }
    }

    // Validate class if being updated
    if (data.classId !== undefined) {
      const academicClass = await this.classRepo.findById(data.classId);
      if (!academicClass) {
        return {
          success: false,
          error: StudentErrors.CLASS_NOT_FOUND
        };
      }
    }

    // Update student profile
    try {
      const updated = await this.studentRepo.update(id, data);
      return {
        success: true,
        data: updated
      };
    } catch (error) {
      // Handle unique constraint violation from database
      if (error instanceof Error && error.message.includes('unique')) {
        return {
          success: false,
          error: StudentErrors.DUPLICATE_STUDENT_CODE
        };
      }
      throw error;
    }
  }
}
