
import type { OpenAlexApiPort } from "../domain/Ports.js";
import type { OpenAlexWork } from "../domain/Types.js";

export interface GetWorkByIdCommand {
  id: string;
}

export interface GetWorkByIdResult {
  work: OpenAlexWork;
}

export class GetWorkById {
  constructor(private readonly apiClient: OpenAlexApiPort) {}

  async execute(command: GetWorkByIdCommand): Promise<GetWorkByIdResult> {
    const work = await this.apiClient.getWorkById(command.id);

    return { work };
  }
}
