/**
 * OpenAlex Module Container
 * 
 * Centralized dependency wiring for the OpenAlex module.
 */

import type { PrismaClient } from "../../generated/prisma/index.js";
import type { BibliographyService } from "../bibliography/application/BibliographyService.js";
import type { ProjectWriteAccessPolicy } from "../projects/domain/access/ProjectAccessPolicies.js";

// Infrastructure
import { OpenAlexApiClient } from "./infra/OpenAlexApiClient.js";
import { OpenAlexImportLogRepoPrisma } from "./infra/OpenAlexImportLogRepoPrisma.js";

// Use Cases
import { SearchWorks } from "./application/SearchWorks.js";
import { GetWorkById } from "./application/GetWorkById.js";
import { ImportToBibFile } from "./application/ImportToBibFile.js";

/**
 * OpenAlex Module Container
 */
export class OpenAlexContainer {
  // Use Cases
  public readonly searchWorks: SearchWorks;
  public readonly getWorkById: GetWorkById;
  public readonly importToBibFile: ImportToBibFile;

  constructor(
    prisma: PrismaClient,
    bibliography: BibliographyService,
    projectAccess: ProjectWriteAccessPolicy,
    openalexMailto?: string
  ) {
    // Initialize infrastructure
    const apiClient = new OpenAlexApiClient({
      mailto: openalexMailto,
    });
    const importLogRepo = new OpenAlexImportLogRepoPrisma(prisma);

    // Wire use cases
    this.searchWorks = new SearchWorks(apiClient);
    this.getWorkById = new GetWorkById(apiClient);
    this.importToBibFile = new ImportToBibFile(
      apiClient,
      bibliography,
      projectAccess,
      importLogRepo
    );
  }
}
