
import type { PrismaClient } from "../../generated/prisma/index.js";
import type { BibliographyService } from "../bibliography/application/BibliographyService.js";
import type { ProjectWriteAccessPolicy } from "../projects/domain/access/ProjectAccessPolicies.js";

import { OpenAlexApiClient } from "./infra/OpenAlexApiClient.js";
import { OpenAlexImportLogRepoPrisma } from "./infra/OpenAlexImportLogRepoPrisma.js";

import { SearchWorks } from "./application/SearchWorks.js";
import { GetWorkById } from "./application/GetWorkById.js";
import { ImportToBibFile } from "./application/ImportToBibFile.js";

export class OpenAlexContainer {
  public readonly searchWorks: SearchWorks;
  public readonly getWorkById: GetWorkById;
  public readonly importToBibFile: ImportToBibFile;

  constructor(
    prisma: PrismaClient,
    bibliography: BibliographyService,
    projectAccess: ProjectWriteAccessPolicy,
    openalexMailto?: string
  ) {
    const apiClient = new OpenAlexApiClient({
      mailto: openalexMailto,
    });
    const importLogRepo = new OpenAlexImportLogRepoPrisma(prisma);

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
