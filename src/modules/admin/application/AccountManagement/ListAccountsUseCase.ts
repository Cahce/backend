import type { AdminAccountRepo } from '../../domain/AccountManagement/Ports.js';
import type {
  AccountWithLink,
  ListAccountsQuery,
} from '../../domain/AccountManagement/Types.js';
import type { Result, PaginatedResult } from '../Types.js';
import { success, failure } from '../Types.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class ListAccountsUseCase {
  constructor(private readonly accountRepo: AdminAccountRepo) {}

  async execute(query: ListAccountsQuery): Promise<Result<PaginatedResult<AccountWithLink>>> {
    try {
      const page = Math.max(query.page ?? DEFAULT_PAGE, 1);
      const pageSize = Math.min(
        Math.max(query.pageSize ?? DEFAULT_PAGE_SIZE, 1),
        MAX_PAGE_SIZE
      );
      const result = await this.accountRepo.list({ ...query, page, pageSize });
      return success(result);
    } catch {
      return failure('INTERNAL_ERROR', 'Lỗi khi lấy danh sách tài khoản');
    }
  }
}
