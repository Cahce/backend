
import type { ZoteroConnectionRepo } from "../domain/Ports.js";
import { ZoteroNotConnectedError } from "../domain/Errors.js";

export interface DisconnectZoteroCommand {
  userId: string;
}

export interface DisconnectZoteroResult {
  success: boolean;
}

export class DisconnectZotero {
  constructor(private readonly connRepo: ZoteroConnectionRepo) {}

  async execute(command: DisconnectZoteroCommand): Promise<DisconnectZoteroResult> {
    const { userId } = command;

    const existing = await this.connRepo.getByUserId(userId);
    if (!existing) {
      throw new ZoteroNotConnectedError();
    }

    await this.connRepo.deleteByUserId(userId);

    return { success: true };
  }
}
