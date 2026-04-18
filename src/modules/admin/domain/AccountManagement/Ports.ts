// Repository port for Account management
// Defines the interface that infrastructure must implement

import type { AccountWithProfile } from './Types.js';

export interface AdminAccountRepo {
  /**
   * Find account by ID with profile information
   */
  findByIdWithProfile(id: string): Promise<AccountWithProfile | null>;

  /**
   * Find account by email with profile information
   */
  findByEmailWithProfile(email: string): Promise<AccountWithProfile | null>;
}
