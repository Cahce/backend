// Use case for creating a student profile
// No framework dependencies

import type { Result } from '../Types.js';
import type { StudentProfile, CreateStudentData } from '../../domain/StudentManagement/Types.js';
import type { StudentProfileRepo } from '../../domain/StudentManagement/Ports.js';
import type { ClassRepo } from '../../domain/Class/Ports.js';
import { StudentPolicy } from '../../domain/StudentManagement/Policies.js';
import { StudentErrors } from '../../domain/StudentManagement/Errors.js';

export class CreateStudentProfileUseCase {
  constructor(
    private readonly studentRepo: StudentProfileRepo,
    private readonly classRepo: ClassRepo
  ) {}

  async execute(data: CreateStudentData): Promise<Result<StudentProfile>> {
    // Validate student code
    const codeValidation = StudentPolicy.validateStudentCode(data.studentCode);
    if (!codeValidation.success) {
      return codeValidation;
    }

    // Validate full name
    const nameValidation = StudentPolicy.validateFullName(data.fullName);
    if (!nameValidation.success) {
      return nameValidation;
    }

    // Check if student code already exists
    const existing = await this.studentRepo.findByStudentCode(data.studentCode);
    if (existing) {
      return {
        success: false,
        error: StudentErrors.DUPLICATE_STUDENT_CODE
      };
    }

    // Validate class exists
    const academicClass = await this.classRepo.findById(data.classId);
    if (!academicClass) {
      return {
        success: false,
        error: StudentErrors.CLASS_NOT_FOUND
      };
    }

    // Create student profile
    try {
      const student = await this.studentRepo.create(data);
      return {
        success: true,
        data: student
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
