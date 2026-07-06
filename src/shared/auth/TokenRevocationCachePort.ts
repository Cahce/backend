export type TokenRevocationStatus = 'valid' | 'revoked';

export interface TokenRevocationCachePort {
  get(jti: string): TokenRevocationStatus | undefined;
  set(jti: string, status: TokenRevocationStatus): void;
  delete(jti: string): void;
}
