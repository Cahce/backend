/**
 * Create Major Use Case
 * 
 * Application layer orchestration for creating a new major.
 */

import type { MajorRepo } from '../../domain/Major/Ports.js';
import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import type { Major, CreateMajorData } from '../../domain/Major/Types.js';
import { MajorErrors } from '../../domain/Major/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class CreateMajorUseCase {
  constructor(
    private readonly majorRepo: MajorRepo,
    private readonly facultyRepo: FacultyRepo
  ) {}

  async execute(data: CreateMajorData): Promise<Result<Major>> {
    try {
      // Validate parent faculty exists
      const faculty = await this.facultyRepo.findById(data.facultyId);
      if (!faculty) {
        const error = MajorErrors.FACULTY_NOT_FOUND;
        return failure(error.code, error.message);
      }

      // Check for duplicate code
      const existing = await this.majorRepo.findByCode(data.code);
      if (existing) {
        const error = MajorErrors.DUPLICATE_CODE;
        return failure(error.code, error.message);
      }

      // Create major
      const major = await this.majorRepo.create(data);
      return success(major);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi tạo ngành');
    }
  }
}
