/**
 * Delete Major Use Case
 * 
 * Application layer orchestration for deleting a major.
 * Enforces business rules: cannot delete if has child classes.
 */

import type { MajorRepo } from '../../domain/Major/Ports.js';
import { MajorPolicy } from '../../domain/Major/Policies.js';
import { MajorErrors } from '../../domain/Major/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class DeleteMajorUseCase {
  constructor(private readonly majorRepo: MajorRepo) {}

  async execute(id: string): Promise<Result<void>> {
    try {
      // Check if major exists
      const major = await this.majorRepo.findById(id);
      if (!major) {
        const error = MajorErrors.MAJOR_NOT_FOUND;
        return failure(error.code, error.message);
      }

      // Check for child classes
      const hasClasses = await this.majorRepo.hasChildClasses(id);

      // Apply deletion policy
      const policyResult = MajorPolicy.canDeleteMajor(hasClasses);
      if (!policyResult.success) {
        return failure(policyResult.error.code, policyResult.error.message);
      }

      // Delete major
      await this.majorRepo.delete(id);
      return success(undefined);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi xóa ngành');
    }
  }
}
