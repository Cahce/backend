// Use case for updating a teacher profile
// No framework dependencies

import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';
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
    const existing = await this.teacherRepo.findById(id);
    if (!existing) {
      return failure(TeacherErrors.TEACHER_NOT_FOUND.code, TeacherErrors.TEACHER_NOT_FOUND.message);
    }

    if (data.teacherCode !== undefined) {
      const codeValidation = TeacherPolicy.validateTeacherCode(data.teacherCode);
      if (!codeValidation.success) {
        return codeValidation;
      }

      const duplicate = await this.teacherRepo.findByTeacherCode(data.teacherCode);
      if (duplicate && duplicate.id !== id) {
        return failure(
          TeacherErrors.DUPLICATE_TEACHER_CODE.code,
          TeacherErrors.DUPLICATE_TEACHER_CODE.message
        );
      }
    }

    if (data.fullName !== undefined) {
      const nameValidation = TeacherPolicy.validateFullName(data.fullName);
      if (!nameValidation.success) {
        return nameValidation;
      }
    }

    if (data.academicRank !== undefined) {
      const rankValidation = TeacherPolicy.validateAcademicRank(data.academicRank);
      if (!rankValidation.success) {
        return rankValidation;
      }
    }

    if (data.academicDegree !== undefined) {
      const degreeValidation = TeacherPolicy.validateAcademicDegree(data.academicDegree);
      if (!degreeValidation.success) {
        return degreeValidation;
      }
    }

    if (data.departmentId !== undefined) {
      const department = await this.departmentRepo.findById(data.departmentId);
      if (!department) {
        return failure(
          TeacherErrors.DEPARTMENT_NOT_FOUND.code,
          TeacherErrors.DEPARTMENT_NOT_FOUND.message
        );
      }
    }

    try {
      const updated = await this.teacherRepo.update(id, data);
      return success(updated);
    } catch (error) {
      if (error instanceof Error && error.message.includes('unique')) {
        return failure(
          TeacherErrors.DUPLICATE_TEACHER_CODE.code,
          TeacherErrors.DUPLICATE_TEACHER_CODE.message
        );
      }
      throw error;
    }
  }
}
