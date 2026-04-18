/**
 * Create Faculty Use Case
 * 
 * Application layer orchestration for creating a new faculty.
 */

import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import type { Faculty, CreateFacultyData } from '../../domain/Faculty/Types.js';
import { FacultyErrors } from '../../domain/Faculty/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class CreateFacultyUseCase {
  constructor(private readonly facultyRepo: FacultyRepo) {}

  async execute(data: CreateFacultyData): Promise<Result<Faculty>> {
    try {
      // Check for duplicate code
      const existing = await this.facultyRepo.findByCode(data.code);
      if (existing) {
        const error = FacultyErrors.DUPLICATE_CODE;
        return failure(error.code, error.message);
      }

      // Create faculty
      const faculty = await this.facultyRepo.create(data);
      return success(faculty);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi tạo khoa');
    }
  }
}
