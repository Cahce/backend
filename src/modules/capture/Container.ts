/**
 * Capture Module Container
 *
 * Wires the capture use cases. The translation-server client is constructed
 * here (matching the openalex/zotero container pattern); the library writer is
 * injected from app.ts as an adapter over the zotero module.
 */

import type { BibliographyService } from "../bibliography/application/BibliographyService.js";
import type { ProjectWriteAccessPolicy } from "../projects/domain/access/ProjectAccessPolicies.js";
import type { LibraryWriterPort, IdentifierFallbackPort } from "./domain/Ports.js";

import { TranslationServerClient } from "./infra/TranslationServerClient.js";
import { ResolveReference } from "./application/ResolveReference.js";
import { CaptureToProject } from "./application/CaptureToProject.js";

export class CaptureContainer {
  public readonly resolveReference: ResolveReference;
  public readonly captureToProject: CaptureToProject;

  constructor(
    bibliography: BibliographyService,
    projectAccess: ProjectWriteAccessPolicy,
    libraryWriter: LibraryWriterPort,
    translationServerUrl?: string,
    identifierFallback?: IdentifierFallbackPort | null
  ) {
    const translation = new TranslationServerClient({
      baseUrl: translationServerUrl,
    });

    this.resolveReference = new ResolveReference(translation, identifierFallback);
    this.captureToProject = new CaptureToProject(
      translation,
      bibliography,
      projectAccess,
      libraryWriter,
      identifierFallback
    );
  }
}
