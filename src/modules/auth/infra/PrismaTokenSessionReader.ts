import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { TokenSessionIdentity, TokenSessionReader, TokenSessionState } from '../domain/TokenSession.js';

export class PrismaTokenSessionReader implements TokenSessionReader {
  constructor(private readonly prisma: PrismaClient) {}

  async readMany(identities: readonly TokenSessionIdentity[]): Promise<(TokenSessionState | null)[]> {
    if (!identities.length) return [];
    // One primary snapshot for user flags, current role and JTI. Transaction-local
    // statement timeout works through transaction pooling without leaking SET.
    const rows = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
      return tx.$queryRaw<(Omit<TokenSessionState, 'userId'> & { userId: string | null })[]>`
        SELECT u.id AS "userId", u.role, u."isActive", u."mustChangePassword",
          (revoked.jti IS NOT NULL) AS revoked
        FROM jsonb_array_elements(${JSON.stringify(identities)}::jsonb) WITH ORDINALITY AS r(value, ordinal)
        LEFT JOIN "User" u ON u.id = r.value->>'userId'
        LEFT JOIN "InvalidToken" revoked ON revoked.jti = r.value->>'jti'
        ORDER BY r.ordinal
      `;
    }, { maxWait: 3000, timeout: 4000 });
    return rows.map(row => row.userId === null ? null : { ...row, userId: row.userId });
  }
}
