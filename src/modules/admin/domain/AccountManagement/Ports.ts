// Repository port for Account management
// Defines the interface that infrastructure must implement

import type {
  Account,
  AccountWithLink,
  AccountWithProfile,
  CreateAccountInput,
  ListAccountsQuery,
  UpdateAccountInput,
} from './Types.js';
import type { PaginatedResult } from '../shared/Pagination.js';

/**
 * Account repository port.
 *
 * Single canonical port for the AccountManagement subdomain. Infrastructure
 * (Prisma) implements this interface. Application layer depends only on
 * this interface and the domain types.
 */
export interface AdminAccountRepo {
  /**
   * Find account by ID with profile information.
   */
  findByIdWithProfile(id: string): Promise<AccountWithProfile | null>;

  /**
   * Find account by email with profile information.
   */
  findByEmailWithProfile(email: string): Promise<AccountWithProfile | null>;

  /**
   * Find account by ID enriched with link summary.
   */
  findById(id: string): Promise<AccountWithLink | null>;

  /**
   * Find account by email.
   */
  findByEmail(email: string): Promise<Account | null>;

  /**
   * List accounts with filtering and pagination.
   */
  list(query: ListAccountsQuery): Promise<PaginatedResult<AccountWithLink>>;

  /**
   * Create a new account.
   */
  create(data: CreateAccountInput): Promise<Account>;

  /**
   * Update an account.
   */
  update(id: string, data: UpdateAccountInput): Promise<Account>;

  /**
   * Reset password atomically (sets passwordHash + passwordChangedAt in one txn).
   */
  resetPassword(id: string, passwordHash: string): Promise<Account>;

  /**
   * Delete an account.
   */
  delete(id: string): Promise<void>;

  /**
   * Check if account has a linked teacher profile.
   */
  hasLinkedTeacher(accountId: string): Promise<boolean>;

  /**
   * Check if account has a linked student profile.
   */
  hasLinkedStudent(accountId: string): Promise<boolean>;

  /**
   * Link an account to a teacher profile.
   */
  linkToTeacher(accountId: string, teacherId: string): Promise<void>;

  /**
   * Link an account to a student profile.
   */
  linkToStudent(accountId: string, studentId: string): Promise<void>;
}
