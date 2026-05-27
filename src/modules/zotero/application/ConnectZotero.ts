/**
 * Connect Zotero Use Case
 *
 * Connects a user's Zotero account by verifying credentials and storing the
 * connection. The library to connect can be specified explicitly; if it is
 * omitted, the personal library is derived from the API key via
 * GET /keys/current.
 */

import type { ZoteroConnectionRepo, ZoteroApiPort } from "../domain/Ports.js";
import type { ZoteroConnectionRecord } from "../domain/Types.js";
import { ZoteroAlreadyConnectedError } from "../domain/Errors.js";

export interface ConnectZoteroCommand {
  userId: string;
  apiKey: string;
  libraryId?: string;
  libraryType?: "user" | "group";
}

export interface ConnectZoteroResult {
  connection: ZoteroConnectionRecord;
}

export class ConnectZotero {
  constructor(
    private readonly connRepo: ZoteroConnectionRepo,
    private readonly apiClient: ZoteroApiPort
  ) {}

  async execute(command: ConnectZoteroCommand): Promise<ConnectZoteroResult> {
    const { userId, apiKey } = command;

    const existing = await this.connRepo.getByUserId(userId);
    if (existing) {
      throw new ZoteroAlreadyConnectedError();
    }

    let libraryId = command.libraryId;
    let libraryType = command.libraryType;

    if (!libraryId || !libraryType) {
      const info = await this.apiClient.getKeyInfo(apiKey);
      libraryId = libraryId ?? info.userId;
      libraryType = libraryType ?? "user";
    } else {
      // User picked a specific library — confirm the API key has access to it.
      await this.apiClient.verifyKey(libraryType, libraryId, apiKey);
    }

    const connection = await this.connRepo.upsert({
      userId,
      accessToken: apiKey,
      libraryId,
      libraryType,
    });

    return { connection };
  }
}
