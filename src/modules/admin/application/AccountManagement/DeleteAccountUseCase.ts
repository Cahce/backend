import type { AdminAccountRepo } from '../../domain/AccountManagement/Ports.js';
import { AccountErrors } from '../../domain/AccountManagement/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export interface DeleteAccountCommand {
  id: string;
}

export class DeleteAccountUseCase {
  constructor(private readonly accountRepo: AdminAccountRepo) {}

  async execute(command: DeleteAccountCommand): Promise<Result<void>> {
    const { id } = command;

    const account = await this.accountRepo.findById(id);
    if (!account) {
      return failure(AccountErrors.ACCOUNT_NOT_FOUND.code, AccountErrors.ACCOUNT_NOT_FOUND.message);
    }

    const [hasTeacher, hasStudent] = await Promise.all([
      this.accountRepo.hasLinkedTeacher(id),
      this.accountRepo.hasLinkedStudent(id),
    ]);
    if (hasTeacher || hasStudent) {
      return failure(AccountErrors.ACCOUNT_HAS_LINK.code, AccountErrors.ACCOUNT_HAS_LINK.message);
    }

    await this.accountRepo.delete(id);
    return success(undefined);
  }
}
