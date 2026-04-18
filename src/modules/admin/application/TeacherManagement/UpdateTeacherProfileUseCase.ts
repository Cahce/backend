// Use case for updating a teacher profile
// No framework dependencies

import type { Result } from '../Types.js';
import type { TeacherProfile, UpdateTeacherData } from '../../domain/TeacherManagement/Types.js';
import type { TeacherProfileRepo } from '../../domain/TeacherManagement/Ports.js';
import type { DepartmentRepo } from '../../domain/Department/Ports.js';
import { TeacherPolicy } from '../../domain/TeacherManagement/Policies.js';
import { TeacherErrors } from '../../domain/TeacherManagement/Errors.js';

export class UpdateTeacherProfileUseCase {
  constructor(
    private readonly teacherRepo: TeacherProfileRepo,
    private readonly departmentRepo: DepartmentRepo
  ) {}

  async execute(id: string, data: UpdateTeacherData): Promise<Result<TeacherProfile>> {
    // Check if teacher exists
    const existing = await this.teacherRepo.findById(id);
    if (!existing) {
      return {
        success: false,
        error: TeacherErrors.TEACHER_NOT_FOUND
      };
    }

    // Validate teacher code if being updated
    if (data.teacherCode !== undefined) {
      const codeValidation = TeacherPolicy.validateTeacherCode(data.teacherCode);
      if (!codeValidation.success) {
        return codeValidation;
      }

      // Check for duplicate teacher code (excluding current teacher)
      const duplicate = await this.teacherRepo.findByTeacherCode(data.teacherCode);
      if (duplicate && duplicate.id !== id) {
        return {
          success: false,
          error: TeacherErrors.DUPLICATE_TEACHER_CODE
        };
      }
    }

    // Validate full name if being updated
    if (data.fullName !== undefined) {
      const nameValidation = TeacherPolicy.validateFullName(data.fullName);
      if (!nameValidation.success) {
        return nameValidation;
      }
    }

    // Validate academic rank if being updated
    if (data.academicRank !== undefined) {
      const rankValidation = TeacherPolicy.validateAcademicRank(data.academicRank);
      if (!rankValidation.success) {
        return rankValidation;
      }
    }

    // Validate academic degree if being updated
    if (data.academicDegree !== undefined) {
      const degreeValidation = TeacherPolicy.validateAcademicDegree(data.academicDegree);
      if (!degreeValidation.success) {
        return degreeValidation;
      }
    }

    // Validate department if being updated
    if (data.departmentId !== undefined) {
      const department = await this.departmentRepo.findById(data.departmentId);
      if (!department) {
        return {
          success: false,
          error: TeacherErrors.DEPARTMENT_NOT_FOUND
        };
      }
    }

    // Update teacher profile
    try {
      const updated = await this.teacherRepo.update(id, data);
      return {
        success: true,
        data: updated
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
