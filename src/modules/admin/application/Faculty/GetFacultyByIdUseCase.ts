/**
 * Get Faculty By Id Use Case
 * 
 * Application layer orchestration for retrieving a single faculty by ID.
 */

import type { FacultyRepo } from '../../domain/Faculty/Ports.js';
import type { Faculty } from '../../domain/Faculty/Types.js';
import { FacultyErrors } from '../../domain/Faculty/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class GetFacultyByIdUseCase {
  constructor(private readonly facultyRepo: FacultyRepo) {}

  async execute(id: string): Promise<Result<Faculty>> {
    try {
      const faculty = await this.facultyRepo.findById(id);
      
      if (!faculty) {
        const error = FacultyErrors.FACULTY_NOT_FOUND;
        return failure(error.code, error.message);
      }

      return success(faculty);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy thông tin khoa');
    }
  }
}
