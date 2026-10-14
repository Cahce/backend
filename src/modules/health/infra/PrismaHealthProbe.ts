import type { PrismaClient } from '../../../generated/prisma/index.js';
import type { HealthProbe } from '../domain/HealthProbe.js';

export class PrismaHealthProbe implements HealthProbe {
  constructor(private readonly prisma: PrismaClient) {}
  async check() { await this.prisma.$queryRaw`SELECT 1`; }
}
