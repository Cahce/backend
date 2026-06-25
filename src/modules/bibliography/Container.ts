/**
 * Bibliography module container.
 */

import type { ProjectAccessPolicy } from "../projects/domain/access/ProjectAccessPolicies.js";
import type { BibliographyService } from "./application/BibliographyService.js";
import { CheckDuplicates } from "./application/CheckDuplicates.js";

export class BibliographyContainer {
  public readonly checkDuplicates: CheckDuplicates;

  constructor(
    bibliography: BibliographyService,
    projectAccess: ProjectAccessPolicy
  ) {
    this.checkDuplicates = new CheckDuplicates(bibliography, projectAccess);
  }
}
