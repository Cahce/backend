/**
 * Zotero Connection Repository (Prisma)
 * 
 * Infrastructure adapter for ZoteroConnection persistence.
 */

import type { PrismaClient } from "../../../generated/prisma/index.js";
import type { ZoteroConnectionRepo } from "../domain/Ports.js";
import type { ZoteroConnectionRecord } from "../domain/Types.js";
import type { SecretCipher } from "../../../shared/crypto/SecretCipher.js";

/**
 * Prisma implementation of ZoteroConnectionRepo
 */
export class ZoteroConnectionRepoPrisma implements ZoteroConnectionRepo {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cipher: SecretCipher
  ) {}

  /**
   * Get connection by user ID
   */
  async getByUserId(userId: string): Promise<ZoteroConnectionRecord | null> {
    const conn = await this.prisma.zoteroConnection.findFirst({
      where: { userId },
    });

    if (!conn) {
      return null;
    }

    // Decrypt access token before returning
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

  /**
   * Create or update connection
   */
  async upsert(
    record: Omit<ZoteroConnectionRecord, "id" | "connectedAt" | "lastSyncedAt">
  ): Promise<ZoteroConnectionRecord> {
    // Encrypt access token before storing
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

    // Decrypt token for return value
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

  /**
   * Delete connection by user ID
   */
  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.zoteroConnection.deleteMany({
      where: { userId },
    });
  }

  /**
   * Update lastSyncedAt timestamp
   */
  async touchLastSyncedAt(connectionId: string): Promise<void> {
    await this.prisma.zoteroConnection.update({
      where: { id: connectionId },
      data: { lastSyncedAt: new Date() },
    });
  }
}
