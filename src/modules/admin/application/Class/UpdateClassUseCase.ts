/**
 * Update Class Use Case
 * 
 * Application layer orchestration for updating an existing academic class.
 */

import type { ClassRepo } from '../../domain/Class/Ports.js';
import type { MajorRepo } from '../../domain/Major/Ports.js';
import type { Class, UpdateClassData } from '../../domain/Class/Types.js';
import { ClassErrors } from '../../domain/Class/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class UpdateClassUseCase {
  constructor(
    private readonly classRepo: ClassRepo,
    private readonly majorRepo: MajorRepo
  ) {}

  async execute(
    id: string,
    data: UpdateClassData
  ): Promise<Result<Class>> {
    try {
      // Check if class exists
      const existing = await this.classRepo.findById(id);
      if (!existing) {
        const error = ClassErrors.CLASS_NOT_FOUND;
        return failure(error.code, error.message);
      }

      // Validate parent major if majorId is being changed
      if (data.majorId && data.majorId !== existing.majorId) {
        const major = await this.majorRepo.findById(data.majorId);
        if (!major) {
          const error = ClassErrors.MAJOR_NOT_FOUND;
          return failure(error.code, error.message);
        }
      }

      // Check for duplicate code if code is being changed
      if (data.code && data.code !== existing.code) {
        const duplicate = await this.classRepo.findByCode(data.code);
        if (duplicate) {
          const error = ClassErrors.DUPLICATE_CODE;
          return failure(error.code, error.message);
        }
      }

      // Update class
      const classEntity = await this.classRepo.update(id, data);
      return success(classEntity);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi cập nhật lớp');
    }
  }
}
