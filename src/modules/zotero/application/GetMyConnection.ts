
import type { ZoteroConnectionRepo } from "../domain/Ports.js";

export interface GetMyConnectionCommand {
  userId: string;
}

export interface ConnectionDto {
  id: string;
  libraryId: string;
  libraryType: "user" | "group";
  connectedAt: Date;
  lastSyncedAt: Date | null;
  hasApiKey: boolean;
}

export interface GetMyConnectionResult {
  connection: ConnectionDto | null;
}

export class GetMyConnection {
  constructor(private readonly connRepo: ZoteroConnectionRepo) {}

  async execute(command: GetMyConnectionCommand): Promise<GetMyConnectionResult> {
    const { userId } = command;

    const conn = await this.connRepo.getByUserId(userId);

    if (!conn) {
      return { connection: null };
    }

    const dto: ConnectionDto = {
      id: conn.id,
      libraryId: conn.libraryId,
      libraryType: conn.libraryType,
      connectedAt: conn.connectedAt,
      lastSyncedAt: conn.lastSyncedAt,
      hasApiKey: true,
    };

    return { connection: dto };
  }
}
