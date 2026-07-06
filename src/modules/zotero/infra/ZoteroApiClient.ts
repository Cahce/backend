
import type { ZoteroApiPort, ZoteroKeyInfo, ZoteroGroupSummary } from "../domain/Ports.js";
import type { ZoteroItem, ZoteroCollection } from "../domain/Types.js";
import {
  ZoteroAuthError,
  ZoteroLibraryNotFoundError,
  ZoteroSyncError,
  ZoteroRateLimitError,
  ZoteroTimeoutError,
  ZoteroInvalidCredentialsError,
} from "../domain/Errors.js";
import { randomBytes } from "node:crypto";

export interface ZoteroApiClientConfig {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class ZoteroApiClient implements ZoteroApiPort {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(config: ZoteroApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || "https://api.zotero.org";
    this.timeout = config.timeout || 10000;
    this.maxRetries = config.maxRetries || 1;
    this.retryDelay = config.retryDelay || 500;
  }

  async verifyKey(
    libraryType: "user" | "group",
    libraryId: string,
    apiKey: string
  ): Promise<void> {
    const url = `${this.baseUrl}/${libraryType}s/${libraryId}/collections`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: "GET",
        headers: this.buildHeaders(apiKey),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }
    } catch (error) {
      if (
        error instanceof ZoteroAuthError ||
        error instanceof ZoteroLibraryNotFoundError ||
        error instanceof ZoteroInvalidCredentialsError
      ) {
        throw error;
      }
      throw new ZoteroSyncError(`Không thể xác thực API key: ${(error as Error).message}`);
    }
  }

  async getKeyInfo(apiKey: string): Promise<ZoteroKeyInfo> {
    const url = `${this.baseUrl}/keys/current`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: "GET",
        headers: this.buildHeaders(apiKey),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = (await response.json()) as {
        userID: number;
        username?: string;
        displayName?: string;
        access?: {
          user?: { library?: boolean; files?: boolean; notes?: boolean; write?: boolean };
          groups?: Record<string, { library?: boolean; write?: boolean }>;
        };
      };

      if (typeof data.userID !== "number") {
        throw new ZoteroInvalidCredentialsError("Phản hồi của Zotero không hợp lệ");
      }

      return {
        userId: data.userID.toString(),
        username: data.username ?? "",
        displayName: data.displayName,
        access: data.access ?? {},
      };
    } catch (error) {
      if (
        error instanceof ZoteroAuthError ||
        error instanceof ZoteroInvalidCredentialsError ||
        error instanceof ZoteroRateLimitError ||
        error instanceof ZoteroTimeoutError
      ) {
        throw error;
      }
      throw new ZoteroInvalidCredentialsError(
        `Không thể xác thực API key: ${(error as Error).message}`
      );
    }
  }

  async listGroups(userId: string, apiKey: string): Promise<ZoteroGroupSummary[]> {
    const url = `${this.baseUrl}/users/${userId}/groups?limit=100`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: "GET",
        headers: this.buildHeaders(apiKey),
      });

      if (response.status === 404) {
        return [];
      }

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = (await response.json()) as Array<{
        id?: number | string;
        data?: { id?: number | string; name?: string };
        name?: string;
      }>;

      return data
        .map((g) => {
          const id = g.data?.id ?? g.id;
          const name = g.data?.name ?? g.name ?? "";
          if (id === undefined || id === null) return null;
          return { id: id.toString(), name };
        })
        .filter((g): g is ZoteroGroupSummary => g !== null);
    } catch (error) {
      if (
        error instanceof ZoteroAuthError ||
        error instanceof ZoteroInvalidCredentialsError ||
        error instanceof ZoteroRateLimitError ||
        error instanceof ZoteroTimeoutError
      ) {
        throw error;
      }
      throw new ZoteroSyncError(
        `Không thể lấy danh sách nhóm Zotero: ${(error as Error).message}`
      );
    }
  }

  async listCollections(
    libraryType: "user" | "group",
    libraryId: string,
    apiKey: string
  ): Promise<ZoteroCollection[]> {
    const url = `${this.baseUrl}/${libraryType}s/${libraryId}/collections`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: "GET",
        headers: this.buildHeaders(apiKey),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json() as any[];
      return this.parseCollections(data);
    } catch (error) {
      if (error instanceof ZoteroAuthError || error instanceof ZoteroLibraryNotFoundError) {
        throw error;
      }
      throw new ZoteroSyncError(`Không thể lấy danh sách collection: ${(error as Error).message}`);
    }
  }

  async listItems(args: {
    libraryType: "user" | "group";
    libraryId: string;
    apiKey: string;
    collectionKey?: string;
    start?: number;
    limit?: number;
    sort?: string;
    direction?: "asc" | "desc";
  }): Promise<{ items: ZoteroItem[]; total: number }> {
    const { libraryType, libraryId, apiKey, collectionKey, start = 0, limit = 100, sort, direction } = args;

    let url = `${this.baseUrl}/${libraryType}s/${libraryId}/items`;
    if (collectionKey) {
      url = `${this.baseUrl}/${libraryType}s/${libraryId}/collections/${collectionKey}/items`;
    }

    const params = new URLSearchParams({
      start: start.toString(),
      limit: limit.toString(),
      format: "json",
    });
    if (sort) {
      params.set("sort", sort);
    }
    if (direction) {
      params.set("direction", direction);
    }
    url += `?${params.toString()}`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: "GET",
        headers: this.buildHeaders(apiKey),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const totalHeader = response.headers.get("Total-Results");
      const total = totalHeader ? parseInt(totalHeader, 10) : 0;

      const data = await response.json() as any[];
      const items = this.parseItems(data);

      return { items, total };
    } catch (error) {
      if (
        error instanceof ZoteroAuthError ||
        error instanceof ZoteroLibraryNotFoundError ||
        error instanceof ZoteroRateLimitError
      ) {
        throw error;
      }
      throw new ZoteroSyncError(`Không thể lấy danh sách item: ${(error as Error).message}`);
    }
  }

  async getItem(
    libraryType: "user" | "group",
    libraryId: string,
    itemKey: string,
    apiKey: string
  ): Promise<ZoteroItem> {
    const url = `${this.baseUrl}/${libraryType}s/${libraryId}/items/${itemKey}`;

    try {
      const response = await this.fetchWithRetry(url, {
        method: "GET",
        headers: this.buildHeaders(apiKey),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = await response.json();
      return this.parseItem(data);
    } catch (error) {
      if (
        error instanceof ZoteroAuthError ||
        error instanceof ZoteroLibraryNotFoundError
      ) {
        throw error;
      }
      throw new ZoteroSyncError(`Không thể lấy item: ${(error as Error).message}`);
    }
  }

  async getItemsByKeys(
    libraryType: "user" | "group",
    libraryId: string,
    itemKeys: string[],
    apiKey: string
  ): Promise<ZoteroItem[]> {
    if (itemKeys.length === 0) {
      return [];
    }
    const CHUNK_SIZE = 50;
    const collected: ZoteroItem[] = [];

    for (let i = 0; i < itemKeys.length; i += CHUNK_SIZE) {
      const chunk = itemKeys.slice(i, i + CHUNK_SIZE);
      const params = new URLSearchParams({
        itemKey: chunk.join(","),
        format: "json",
        limit: String(chunk.length),
      });
      const url = `${this.baseUrl}/${libraryType}s/${libraryId}/items?${params.toString()}`;

      try {
        const response = await this.fetchWithRetry(url, {
          method: "GET",
          headers: this.buildHeaders(apiKey),
        });

        if (!response.ok) {
          throw await this.handleErrorResponse(response);
        }

        const data = (await response.json()) as any[];
        collected.push(...this.parseItems(data));
      } catch (error) {
        if (
          error instanceof ZoteroAuthError ||
          error instanceof ZoteroLibraryNotFoundError ||
          error instanceof ZoteroRateLimitError
        ) {
          throw error;
        }
        throw new ZoteroSyncError(`Không thể lấy item theo khóa: ${(error as Error).message}`);
      }
    }

    return collected;
  }

  async createItems(
    libraryType: "user" | "group",
    libraryId: string,
    apiKey: string,
    items: ZoteroItem[]
  ): Promise<{ successKeys: string[]; failed: { index: number; message: string }[] }> {
    const url = `${this.baseUrl}/${libraryType}s/${libraryId}/items`;
    const payload = items.map((item) => this.toWritePayload(item));

    try {
      const response = await this.fetchWithRetry(url, {
        method: "POST",
        headers: {
          ...this.buildHeaders(apiKey),
          "Content-Type": "application/json",
          "Zotero-Write-Token": randomBytes(16).toString("hex"),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await this.handleErrorResponse(response);
      }

      const data = (await response.json()) as {
        successful?: Record<string, { key?: string }>;
        success?: Record<string, string>;
        failed?: Record<string, { code?: number; message?: string }>;
      };

      const successKeys: string[] = [];
      if (data.successful && Object.keys(data.successful).length > 0) {
        for (const entry of Object.values(data.successful)) {
          if (entry?.key) successKeys.push(entry.key);
        }
      } else if (data.success) {
        successKeys.push(...Object.values(data.success));
      }

      const failed = data.failed
        ? Object.entries(data.failed).map(([index, f]) => ({
            index: Number.parseInt(index, 10),
            message: f?.message ?? `Zotero error ${f?.code ?? ""}`.trim(),
          }))
        : [];

      return { successKeys, failed };
    } catch (error) {
      if (
        error instanceof ZoteroAuthError ||
        error instanceof ZoteroLibraryNotFoundError ||
        error instanceof ZoteroRateLimitError
      ) {
        throw error;
      }
      throw new ZoteroSyncError(
        `Không thể ghi item vào Zotero: ${(error as Error).message}`
      );
    }
  }

  private toWritePayload(item: ZoteroItem): Record<string, unknown> {
    const payload: Record<string, unknown> = { itemType: item.itemType };
    const set = (key: string, value: unknown) => {
      if (value !== undefined && value !== null && value !== "") {
        payload[key] = value;
      }
    };
    set("title", item.title);
    set("creators", item.creators);
    set("date", item.date);
    set("publicationTitle", item.publicationTitle);
    set("volume", item.volume);
    set("issue", item.issue);
    set("pages", item.pages);
    set("DOI", item.DOI);
    set("ISSN", item.ISSN);
    set("publisher", item.publisher);
    set("place", item.place);
    set("edition", item.edition);
    set("numPages", item.numPages);
    set("ISBN", item.ISBN);
    set("proceedingsTitle", item.proceedingsTitle);
    set("conferenceName", item.conferenceName);
    set("university", item.university);
    set("thesisType", item.thesisType);
    set("institution", item.institution);
    set("reportNumber", item.reportNumber);
    set("reportType", item.reportType);
    set("url", item.url);
    set("accessDate", item.accessDate);
    set("websiteTitle", item.websiteTitle);
    set("abstractNote", item.abstractNote);
    set("language", item.language);
    set("rights", item.rights);
    set("extra", item.extra);
    set("tags", item.tags);
    return payload;
  }

  private buildHeaders(apiKey: string): Record<string, string> {
    return {
      "Zotero-API-Key": apiKey,
      "Zotero-API-Version": "3",
      "User-Agent": "TypstScholarBackend/1.0",
    };
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt: number = 0
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if ((response.status === 429 || response.status >= 500) && attempt < this.maxRetries) {
        await this.delay(this.retryDelay * Math.pow(2, attempt));
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === "AbortError") {
        throw new ZoteroTimeoutError();
      }

      if (attempt < this.maxRetries) {
        await this.delay(this.retryDelay * Math.pow(2, attempt));
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      throw error;
    }
  }

  private async handleErrorResponse(response: Response): Promise<Error> {
    const status = response.status;

    let detail: string | undefined;
    try {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text) as { message?: string };
          detail = data.message ?? text;
        } catch {
          detail = text;
        }
      }
    } catch {
    }

    if (status === 401 || status === 403) {
      return new ZoteroAuthError(
        detail ? `API key Zotero không hợp lệ: ${detail}` : undefined
      );
    }

    if (status === 400) {
      return new ZoteroInvalidCredentialsError(
        detail ? `Yêu cầu không hợp lệ: ${detail}` : undefined
      );
    }

    if (status === 404) {
      return new ZoteroLibraryNotFoundError(
        detail ? `Không tìm thấy thư viện Zotero: ${detail}` : undefined
      );
    }

    if (status === 429) {
      return new ZoteroRateLimitError();
    }

    return new ZoteroSyncError(detail ?? `Zotero API error: ${status}`);
  }

  private parseCollections(data: any[]): ZoteroCollection[] {
    return data.map(item => ({
      key: item.key,
      version: item.version,
      name: item.data?.name || item.name || "",
      parentCollection: item.data?.parentCollection || item.parentCollection || false,
      data: item.data,
      relations: item.relations,
    }));
  }

  private parseItems(data: any[]): ZoteroItem[] {
    return data.map(item => this.parseItem(item));
  }

  private parseItem(item: any): ZoteroItem {
    const data = item.data || item;

    return {
      key: item.key || data.key,
      version: item.version || data.version,
      itemType: data.itemType,
      title: data.title,
      creators: data.creators,
      date: data.date,
      publicationTitle: data.publicationTitle,
      volume: data.volume,
      issue: data.issue,
      pages: data.pages,
      DOI: data.DOI,
      ISSN: data.ISSN,
      publisher: data.publisher,
      place: data.place,
      edition: data.edition,
      numPages: data.numPages,
      ISBN: data.ISBN,
      proceedingsTitle: data.proceedingsTitle,
      conferenceName: data.conferenceName,
      university: data.university,
      thesisType: data.thesisType,
      institution: data.institution,
      reportNumber: data.reportNumber,
      reportType: data.reportType,
      url: data.url,
      accessDate: data.accessDate,
      websiteTitle: data.websiteTitle,
      abstractNote: data.abstractNote,
      language: data.language,
      rights: data.rights,
      extra: data.extra,
      tags: data.tags,
      collections: data.collections,
      relations: data.relations || item.relations,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
