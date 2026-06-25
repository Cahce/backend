import type { AdminAccountRepo } from '../../domain/AccountManagement/Ports.js';
import type { PasswordHasher } from '../../domain/shared/PasswordHasher.js';
import type { Account } from '../../domain/AccountManagement/Types.js';
import { AccountErrors } from '../../domain/AccountManagement/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export interface ResetAccountPasswordCommand {
  id: string;
  newPassword: string;
}

export class ResetAccountPasswordUseCase {
  constructor(
    private readonly accountRepo: AdminAccountRepo,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(command: ResetAccountPasswordCommand): Promise<Result<Account>> {
    const { id, newPassword } = command;

    const account = await this.accountRepo.findById(id);
    if (!account) {
      return failure(AccountErrors.ACCOUNT_NOT_FOUND.code, AccountErrors.ACCOUNT_NOT_FOUND.message);
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);
    const updated = await this.accountRepo.resetPassword(id, passwordHash);
    return success(updated);
  }
}
