/**
 * Get Work By ID Use Case
 * 
 * Retrieves a single work from OpenAlex by ID.
 */

import type { OpenAlexApiPort } from "../domain/Ports.js";
import type { OpenAlexWork } from "../domain/Types.js";

/**
 * Command to get work by ID
 */
export interface GetWorkByIdCommand {
  id: string;
}

/**
 * Result of getting work
 */
export interface GetWorkByIdResult {
  work: OpenAlexWork;
}

/**
 * Get Work By ID Use Case
 */
export class GetWorkById {
  constructor(private readonly apiClient: OpenAlexApiPort) {}

  async execute(command: GetWorkByIdCommand): Promise<GetWorkByIdResult> {
    const work = await this.apiClient.getWorkById(command.id);

    return { work };
  }
}
