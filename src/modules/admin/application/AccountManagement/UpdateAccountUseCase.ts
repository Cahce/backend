import type { AdminAccountRepo } from '../../domain/AccountManagement/Ports.js';
import type { EmailPolicy } from '../../domain/AccountManagement/Policies.js';
import type { Account, UserRole } from '../../domain/AccountManagement/Types.js';
import { AccountErrors } from '../../domain/AccountManagement/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export interface UpdateAccountCommand {
  id: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
}

export class UpdateAccountUseCase {
  constructor(
    private readonly accountRepo: AdminAccountRepo,
    private readonly emailPolicy: EmailPolicy
  ) {}

  async execute(command: UpdateAccountCommand): Promise<Result<Account>> {
    const { id, email, role, isActive } = command;

    const existing = await this.accountRepo.findById(id);
    if (!existing) {
      return failure(AccountErrors.ACCOUNT_NOT_FOUND.code, AccountErrors.ACCOUNT_NOT_FOUND.message);
    }

    if (email || role) {
      const emailToValidate = email ?? existing.email;
      const roleToValidate = role ?? existing.role;
      const validation = this.emailPolicy.validate(emailToValidate, roleToValidate);
      if (!validation.ok) {
        return failure(validation.code, validation.message);
      }

      if (email && email !== existing.email) {
        const dup = await this.accountRepo.findByEmail(email);
        if (dup) {
          return failure(
            AccountErrors.EMAIL_EXISTS.code,
            AccountErrors.EMAIL_EXISTS.message
          );
        }
      }
    }

    const account = await this.accountRepo.update(id, { email, role, isActive });
    return success(account);
  }
}
