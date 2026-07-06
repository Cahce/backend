
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
