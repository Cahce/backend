/**
 * Update Major Use Case
 * 
 * Application layer orchestration for updating an existing major.
 */

import type { MajorRepo } from '../../domain/Major/Ports.js';
import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import type { Major, UpdateMajorData } from '../../domain/Major/Types.js';
import { MajorErrors } from '../../domain/Major/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class UpdateMajorUseCase {
  constructor(
    private readonly majorRepo: MajorRepo,
    private readonly facultyRepo: FacultyRepo
  ) {}

  async execute(
    id: string,
    data: UpdateMajorData
  ): Promise<Result<Major>> {
    try {
      // Check if major exists
      const existing = await this.majorRepo.findById(id);
      if (!existing) {
        const error = MajorErrors.MAJOR_NOT_FOUND;
        return failure(error.code, error.message);
      }

      // Validate parent faculty if facultyId is being changed
      if (data.facultyId && data.facultyId !== existing.facultyId) {
        const faculty = await this.facultyRepo.findById(data.facultyId);
        if (!faculty) {
          const error = MajorErrors.FACULTY_NOT_FOUND;
          return failure(error.code, error.message);
        }
      }

      // Check for duplicate code if code is being changed
      if (data.code && data.code !== existing.code) {
        const duplicate = await this.majorRepo.findByCode(data.code);
        if (duplicate) {
          const error = MajorErrors.DUPLICATE_CODE;
          return failure(error.code, error.message);
        }
      }

      // Update major
      const major = await this.majorRepo.update(id, data);
      return success(major);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi cập nhật ngành');
    }
  }
}
