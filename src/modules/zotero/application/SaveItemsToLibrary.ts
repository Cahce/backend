
import type { ZoteroConnectionRepo, ZoteroApiPort } from "../domain/Ports.js";
import type { ZoteroItem } from "../domain/Types.js";
import {
  ZoteroNotConnectedError,
  ZoteroWriteForbiddenError,
  ZoteroSyncError,
} from "../domain/Errors.js";

export interface SaveItemsToLibraryCommand {
  userId: string;
  items: ZoteroItem[];
}

export interface SaveItemsToLibraryResult {
  keys: string[];
}

export class SaveItemsToLibrary {
  constructor(
    private readonly connRepo: ZoteroConnectionRepo,
    private readonly apiClient: ZoteroApiPort
  ) {}

  async execute(
    command: SaveItemsToLibraryCommand
  ): Promise<SaveItemsToLibraryResult> {
    const { userId, items } = command;

    if (items.length === 0) {
      return { keys: [] };
    }

    const conn = await this.connRepo.getByUserId(userId);
    if (!conn) {
      throw new ZoteroNotConnectedError();
    }

    const info = await this.apiClient.getKeyInfo(conn.accessToken);
    const canWrite =
      conn.libraryType === "user"
        ? info.access.user?.write === true
        : info.access.groups?.[conn.libraryId]?.write === true ||
          info.access.groups?.all?.write === true;

    if (!canWrite) {
      throw new ZoteroWriteForbiddenError();
    }

    const { successKeys, failed } = await this.apiClient.createItems(
      conn.libraryType,
      conn.libraryId,
      conn.accessToken,
      items
    );

    if (successKeys.length === 0 && failed.length > 0) {
      throw new ZoteroSyncError(
        `Không thể lưu vào Zotero: ${failed[0].message}`
      );
    }

    await this.connRepo.touchLastSyncedAt(conn.id);

    return { keys: successKeys };
  }
}
