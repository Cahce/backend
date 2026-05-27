import type { AdminAccountRepo } from '../../domain/AccountManagement/Ports.js';
import type { AccountWithLink } from '../../domain/AccountManagement/Types.js';
import { AccountErrors } from '../../domain/AccountManagement/Errors.js';
import type { Result } from '../Types.js';
import { success, failure } from '../Types.js';

export interface GetAccountQuery {
  id: string;
}

export class GetAccountUseCase {
  constructor(private readonly accountRepo: AdminAccountRepo) {}

  async execute(query: GetAccountQuery): Promise<Result<AccountWithLink>> {
    const account = await this.accountRepo.findById(query.id);
    if (!account) {
      return failure(AccountErrors.ACCOUNT_NOT_FOUND.code, AccountErrors.ACCOUNT_NOT_FOUND.message);
    }
    return success(account);
  }
}
