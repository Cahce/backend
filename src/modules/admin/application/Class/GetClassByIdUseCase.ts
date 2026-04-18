/**
 * Get Class By Id Use Case
 * 
 * Application layer orchestration for retrieving a single academic class by ID.
 */

import type { ClassRepo } from '../../domain/Class/Ports.js';
import type { ClassWithContext } from '../../domain/Class/Types.js';
import { ClassErrors } from '../../domain/Class/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class GetClassByIdUseCase {
  constructor(private readonly classRepo: ClassRepo) {}

  async execute(id: string): Promise<Result<ClassWithContext>> {
    try {
      const classEntity = await this.classRepo.findById(id);
      
      if (!classEntity) {
        const error = ClassErrors.CLASS_NOT_FOUND;
        return failure(error.code, error.message);
      }

      return success(classEntity);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy thông tin lớp');
    }
  }
}
