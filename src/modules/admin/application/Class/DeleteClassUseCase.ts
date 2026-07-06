
import type { ClassRepo } from '../../domain/Class/Ports.js';
import { ClassPolicy } from '../../domain/Class/Policies.js';
import { ClassErrors } from '../../domain/Class/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export class DeleteClassUseCase {
  constructor(private readonly classRepo: ClassRepo) {}

  async execute(id: string): Promise<Result<void>> {
    try {
      const classEntity = await this.classRepo.findById(id);
      if (!classEntity) {
        const error = ClassErrors.CLASS_NOT_FOUND;
        return failure(error.code, error.message);
      }

      const hasStudents = await this.classRepo.hasLinkedStudents(id);

      const policyResult = ClassPolicy.canDeleteClass(hasStudents);
      if (!policyResult.success) {
        return failure(policyResult.error.code, policyResult.error.message);
      }

      await this.classRepo.delete(id);
      return success(undefined);
    } catch (error) {
      return failure('INTERNAL_ERROR', 'Lỗi khi xóa lớp');
    }
  }
}
