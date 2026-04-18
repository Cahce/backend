/**
 * Get Major By Id Use Case
 * 
 * Application layer orchestration for retrieving a single major by ID.
 */

import type { MajorRepo } from '../../domain/Major/Ports.js';
import type { MajorWithContext } from '../../domain/Major/Types.js';
import { MajorErrors } from '../../domain/Major/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class GetMajorByIdUseCase {
  constructor(private readonly majorRepo: MajorRepo) {}

  async execute(id: string): Promise<Result<MajorWithContext>> {
    try {
      const major = await this.majorRepo.findById(id);
      
      if (!major) {
        const error = MajorErrors.MAJOR_NOT_FOUND;
        return failure(error.code, error.message);
      }

      return success(major);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy thông tin ngành');
    }
  }
}
