
import type { PrismaClient } from "../../../generated/prisma/index.js";
import type { ZoteroConnectionRepo } from "../domain/Ports.js";
import type { ZoteroConnectionRecord } from "../domain/Types.js";
import type { SecretCipher } from "../../../shared/crypto/SecretCipher.js";

export class ZoteroConnectionRepoPrisma implements ZoteroConnectionRepo {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cipher: SecretCipher
  ) {}

  async getByUserId(userId: string): Promise<ZoteroConnectionRecord | null> {
    const conn = await this.prisma.zoteroConnection.findFirst({
      where: { userId },
    });

    if (!conn) {
      return null;
    }

    const decryptedToken = this.cipher.decrypt(conn.accessToken);

    return {
      id: conn.id,
      userId: conn.userId,
      accessToken: decryptedToken,
      libraryId: conn.libraryId,
      libraryType: conn.libraryType as "user" | "group",
      connectedAt: conn.connectedAt,
      lastSyncedAt: conn.lastSyncedAt,
    };
  }

  async upsert(
    record: Omit<ZoteroConnectionRecord, "id" | "connectedAt" | "lastSyncedAt">
  ): Promise<ZoteroConnectionRecord> {
    const encryptedToken = this.cipher.encrypt(record.accessToken);

    const conn = await this.prisma.zoteroConnection.upsert({
      where: {
        userId_provider: {
          userId: record.userId,
          provider: "zotero",
        },
      },
      create: {
        userId: record.userId,
        provider: "zotero",
        accessToken: encryptedToken,
        libraryId: record.libraryId,
        libraryType: record.libraryType,
      },
      update: {
        accessToken: encryptedToken,
        libraryId: record.libraryId,
        libraryType: record.libraryType,
      },
    });

    const decryptedToken = this.cipher.decrypt(conn.accessToken);

    return {
      id: conn.id,
      userId: conn.userId,
      accessToken: decryptedToken,
      libraryId: conn.libraryId,
      libraryType: conn.libraryType as "user" | "group",
      connectedAt: conn.connectedAt,
      lastSyncedAt: conn.lastSyncedAt,
    };
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.zoteroConnection.deleteMany({
      where: { userId },
    });
  }

  async touchLastSyncedAt(connectionId: string): Promise<void> {
    await this.prisma.zoteroConnection.update({
      where: { id: connectionId },
      data: { lastSyncedAt: new Date() },
    });
  }
}
