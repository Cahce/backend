/**
 * Verify Zotero API key (no persistence).
 *
 * Validates a Zotero API key against the Zotero Web API and returns the
 * accessible libraries (personal + groups) so the UI can let the user pick
 * which library to connect.
 */

import type { ZoteroApiPort } from "../domain/Ports.js";

export interface VerifyZoteroKeyCommand {
  apiKey: string;
}

export interface VerifyZoteroLibrary {
  id: string;
  name: string;
  type: "user" | "group";
}

export interface VerifyZoteroKeyResult {
  userId: string;
  username: string;
  displayName?: string;
  libraries: VerifyZoteroLibrary[];
}

export class VerifyZoteroKey {
  constructor(private readonly apiClient: ZoteroApiPort) {}

  async execute(command: VerifyZoteroKeyCommand): Promise<VerifyZoteroKeyResult> {
    const { apiKey } = command;

    const info = await this.apiClient.getKeyInfo(apiKey);
    const libraries: VerifyZoteroLibrary[] = [];

    if (info.access.user?.library !== false) {
      libraries.push({ id: info.userId, name: "My Library", type: "user" });
    }

    const groups = await this.apiClient.listGroups(info.userId, apiKey);
    for (const g of groups) {
      libraries.push({ id: g.id, name: g.name, type: "group" });
    }

    return {
      userId: info.userId,
      username: info.username,
      displayName: info.displayName,
      libraries,
    };
  }
}
