// Use case for creating a teacher profile
// No framework dependencies

import type { Result } from '../Types.js';
import type { TeacherProfile, CreateTeacherData } from '../../domain/TeacherManagement/Types.js';
import type { TeacherProfileRepo } from '../../domain/TeacherManagement/Ports.js';
import type { DepartmentRepo } from '../../domain/Department/Ports.js';
import { TeacherPolicy } from '../../domain/TeacherManagement/Policies.js';
import { TeacherErrors } from '../../domain/TeacherManagement/Errors.js';

export class CreateTeacherProfileUseCase {
  constructor(
    private readonly teacherRepo: TeacherProfileRepo,
    private readonly departmentRepo: DepartmentRepo
  ) {}

  async execute(data: CreateTeacherData): Promise<Result<TeacherProfile>> {
    // Validate teacher code
    const codeValidation = TeacherPolicy.validateTeacherCode(data.teacherCode);
    if (!codeValidation.success) {
      return codeValidation;
    }

    // Validate full name
    const nameValidation = TeacherPolicy.validateFullName(data.fullName);
    if (!nameValidation.success) {
      return nameValidation;
    }

    // Validate academic rank
    const rankValidation = TeacherPolicy.validateAcademicRank(data.academicRank);
    if (!rankValidation.success) {
      return rankValidation;
    }

    // Validate academic degree
    const degreeValidation = TeacherPolicy.validateAcademicDegree(data.academicDegree);
    if (!degreeValidation.success) {
      return degreeValidation;
    }

    // Check if teacher code already exists
    const existing = await this.teacherRepo.findByTeacherCode(data.teacherCode);
    if (existing) {
      return {
        success: false,
        error: TeacherErrors.DUPLICATE_TEACHER_CODE
      };
    }

    // Validate department exists
    const department = await this.departmentRepo.findById(data.departmentId);
    if (!department) {
      return {
        success: false,
        error: TeacherErrors.DEPARTMENT_NOT_FOUND
      };
    }

    // Create teacher profile
    try {
      const teacher = await this.teacherRepo.create(data);
      return {
        success: true,
        data: teacher
      };
    } catch (error) {
      // Handle unique constraint violation from database
      if (error instanceof Error && error.message.includes('unique')) {
        return {
          success: false,
          error: TeacherErrors.DUPLICATE_TEACHER_CODE
        };
      }
      throw error;
    }
  }
}
