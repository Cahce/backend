import type { UserRole } from '../../../shared/auth/Types.js';

export interface TokenSessionIdentity { userId: string; jti: string }
export interface TokenSessionState {
  userId: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  revoked: boolean;
}
/** Results correspond to input order; missing accounts return null. Reads must use primary. */
export interface TokenSessionReader {
  readMany(identities: readonly TokenSessionIdentity[]): Promise<(TokenSessionState | null)[]>;
}
export class SessionVerificationUnavailable extends Error {
  constructor() { super('Session verification unavailable'); }
}
