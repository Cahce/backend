
import type {
  TranslationServerPort,
  IdentifierFallbackPort,
} from "../domain/Ports.js";
import type { CaptureItem } from "../domain/Types.js";
import { resolveReferenceItems } from "./resolveItems.js";

export interface ResolveReferenceCommand {
  url?: string;
  identifier?: string;
}

export interface ResolveReferenceResult {
  items: CaptureItem[];
}

export class ResolveReference {
  constructor(
    private readonly translation: TranslationServerPort,
    private readonly fallback?: IdentifierFallbackPort | null
  ) {}

  async execute(
    command: ResolveReferenceCommand
  ): Promise<ResolveReferenceResult> {
    const items = await resolveReferenceItems(
      this.translation,
      this.fallback,
      command
    );
    return { items };
  }
}
