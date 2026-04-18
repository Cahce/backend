/**
 * Create Class Use Case
 * 
 * Application layer orchestration for creating a new academic class.
 */

import type { ClassRepo } from '../../domain/Class/Ports.js';
import type { MajorRepo } from '../../domain/Major/Ports.js';
import type { Class, CreateClassData } from '../../domain/Class/Types.js';
import { ClassErrors } from '../../domain/Class/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class CreateClassUseCase {
  constructor(
    private readonly classRepo: ClassRepo,
    private readonly majorRepo: MajorRepo
  ) {}

  async execute(data: CreateClassData): Promise<Result<Class>> {
    try {
      // Validate parent major exists
      const major = await this.majorRepo.findById(data.majorId);
      if (!major) {
        const error = ClassErrors.MAJOR_NOT_FOUND;
        return failure(error.code, error.message);
      }

      // Check for duplicate code
      const existing = await this.classRepo.findByCode(data.code);
      if (existing) {
        const error = ClassErrors.DUPLICATE_CODE;
        return failure(error.code, error.message);
      }

      // Create class
      const classEntity = await this.classRepo.create(data);
      return success(classEntity);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi tạo lớp');
    }
  }
}
