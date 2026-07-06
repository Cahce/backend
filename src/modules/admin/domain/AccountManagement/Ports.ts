
import type {
  Account,
  AccountWithLink,
  AccountWithProfile,
  CreateAccountInput,
  ListAccountsQuery,
  UpdateAccountInput,
} from './Types.js';
import type { PaginatedResult } from '../shared/Pagination.js';

export interface AdminAccountRepo {
  findByIdWithProfile(id: string): Promise<AccountWithProfile | null>;

  findByEmailWithProfile(email: string): Promise<AccountWithProfile | null>;

  findById(id: string): Promise<AccountWithLink | null>;

  findByEmail(email: string): Promise<Account | null>;

  list(query: ListAccountsQuery): Promise<PaginatedResult<AccountWithLink>>;

  create(data: CreateAccountInput): Promise<Account>;

  update(id: string, data: UpdateAccountInput): Promise<Account>;

  resetPassword(id: string, passwordHash: string): Promise<Account>;

  delete(id: string): Promise<void>;

  hasLinkedTeacher(accountId: string): Promise<boolean>;

  hasLinkedStudent(accountId: string): Promise<boolean>;

  linkToTeacher(accountId: string, teacherId: string): Promise<void>;

  linkToStudent(accountId: string, studentId: string): Promise<void>;
}
