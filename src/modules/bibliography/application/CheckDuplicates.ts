/**
 * Non-mutating bibliography duplicate check use case.
 */

import type { BibEntry } from "../domain/BibEntry.js";
import type { BibliographyService } from "./BibliographyService.js";
import type { ProjectAccessPolicy } from "../../projects/domain/access/ProjectAccessPolicies.js";
import {
  analyzeDuplicateEntries,
  type DuplicateGroup,
  type DuplicateMatchReason,
} from "../domain/DuplicateDetection.js";

export interface CheckDuplicatesCommand {
  userId: string;
  projectId: string;
  targetBibPath: string;
  candidates?: BibEntry[];
  matchBy?: DuplicateMatchReason[];
}

export interface CheckDuplicatesResult {
  groups: DuplicateGroup[];
  existingCount: number;
  candidateCount: number;
}

export class CheckDuplicates {
  constructor(
    private readonly bibliography: BibliographyService,
    private readonly projectAccess: ProjectAccessPolicy
  ) {}

  async execute(command: CheckDuplicatesCommand): Promise<CheckDuplicatesResult> {
    await this.projectAccess.requireProjectAccess(command.projectId, command.userId);

    const existing = await this.bibliography.readBibFile(
      command.projectId,
      command.targetBibPath
    );
    const candidates = command.candidates ?? [];

    return {
      groups: analyzeDuplicateEntries(existing, {
        candidates,
        matchBy: command.matchBy,
      }),
      existingCount: existing.length,
      candidateCount: candidates.length,
    };
  }
}
