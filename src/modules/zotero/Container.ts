
import type { PrismaClient } from "../../generated/prisma/index.js";
import type { SecretCipher } from "../../shared/crypto/SecretCipher.js";
import type { BibliographyService } from "../bibliography/application/BibliographyService.js";
import type { ProjectAccessPolicy, ProjectWriteAccessPolicy } from "../projects/domain/access/ProjectAccessPolicies.js";

import { ZoteroApiClient } from "./infra/ZoteroApiClient.js";
import { ZoteroConnectionRepoPrisma } from "./infra/ZoteroConnectionRepoPrisma.js";
import { ZoteroSyncLogRepoPrisma } from "./infra/ZoteroSyncLogRepoPrisma.js";

import { ConnectZotero } from "./application/ConnectZotero.js";
import { VerifyZoteroKey } from "./application/VerifyZoteroKey.js";
import { GetMyConnection } from "./application/GetMyConnection.js";
import { DisconnectZotero } from "./application/DisconnectZotero.js";
import { ListCollections } from "./application/ListCollections.js";
import { ListItems } from "./application/ListItems.js";
import { SyncToBibFile } from "./application/SyncToBibFile.js";
import { GetSyncLogs } from "./application/GetSyncLogs.js";
import { SaveItemsToLibrary } from "./application/SaveItemsToLibrary.js";

export class ZoteroContainer {
  public readonly connectZotero: ConnectZotero;
  public readonly verifyZoteroKey: VerifyZoteroKey;
  public readonly getMyConnection: GetMyConnection;
  public readonly disconnectZotero: DisconnectZotero;
  public readonly listCollections: ListCollections;
  public readonly listItems: ListItems;
  public readonly syncToBibFile: SyncToBibFile;
  public readonly getSyncLogs: GetSyncLogs;
  public readonly saveItemsToLibrary: SaveItemsToLibrary;

  constructor(
    prisma: PrismaClient,
    cipher: SecretCipher,
    bibliography: BibliographyService,
    projectAccess: ProjectAccessPolicy & ProjectWriteAccessPolicy,
    zoteroApiBaseUrl?: string
  ) {
    const apiClient = new ZoteroApiClient({
      baseUrl: zoteroApiBaseUrl,
    });
    const connRepo = new ZoteroConnectionRepoPrisma(prisma, cipher);
    const logRepo = new ZoteroSyncLogRepoPrisma(prisma);

    this.connectZotero = new ConnectZotero(connRepo, apiClient);
    this.verifyZoteroKey = new VerifyZoteroKey(apiClient);
    this.getMyConnection = new GetMyConnection(connRepo);
    this.disconnectZotero = new DisconnectZotero(connRepo);
    this.listCollections = new ListCollections(connRepo, apiClient);
    this.listItems = new ListItems(connRepo, apiClient);
    this.syncToBibFile = new SyncToBibFile(
      connRepo,
      apiClient,
      bibliography,
      logRepo,
      projectAccess
    );
    this.getSyncLogs = new GetSyncLogs(logRepo, projectAccess);
    this.saveItemsToLibrary = new SaveItemsToLibrary(connRepo, apiClient);
  }
}
