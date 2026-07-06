
import type { ZoteroConnectionRepo, ZoteroApiPort } from "../domain/Ports.js";
import type { ZoteroCollection } from "../domain/Types.js";
import { ZoteroNotConnectedError } from "../domain/Errors.js";

export interface ListCollectionsCommand {
  userId: string;
}

export interface ListCollectionsResult {
  collections: ZoteroCollection[];
}

export class ListCollections {
  constructor(
    private readonly connRepo: ZoteroConnectionRepo,
    private readonly apiClient: ZoteroApiPort
  ) {}

  async execute(command: ListCollectionsCommand): Promise<ListCollectionsResult> {
    const { userId } = command;

    const conn = await this.connRepo.getByUserId(userId);
    if (!conn) {
      throw new ZoteroNotConnectedError();
    }

    const collections = await this.apiClient.listCollections(
      conn.libraryType,
      conn.libraryId,
      conn.accessToken
    );

    return { collections };
  }
}
