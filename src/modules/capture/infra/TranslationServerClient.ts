/**
 * Translation Server Client
 *
 * Infrastructure adapter for a self-hosted Zotero `translation-server`
 * (https://github.com/zotero/translation-server). Converts a web page URL or
 * an identifier into Zotero-format items using Zotero's own translators.
 *
 * Mirrors the fetch + timeout + retry pattern of `OpenAlexApiClient`.
 */

import type { TranslationServerPort } from "../domain/Ports.js";
import type { CaptureItem } from "../domain/Types.js";
import {
  TranslationUnavailableError,
  TranslationNoResultError,
} from "../domain/Errors.js";

export interface TranslationServerClientConfig {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class TranslationServerClient implements TranslationServerPort {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(config: TranslationServerClientConfig = {}) {
    this.baseUrl = (config.baseUrl || "http://localhost:1969").replace(
      /\/+$/,
      ""
    );
    this.timeout = config.timeout ?? 15000;
    this.maxRetries = config.maxRetries ?? 1;
    this.retryDelay = config.retryDelay ?? 500;
  }

  /** Extract metadata from a web page URL (POST /web, body = URL). */
  async web(url: string): Promise<CaptureItem[]> {
    const response = await this.post("/web", url, "text/plain");

    // 300 = multiple translatable items on the page (e.g. a results list).
    if (response.status === 300) {
      return this.resolveMultiple(response);
    }

    return this.parseItemsResponse(response);
  }

  /** Resolve a DOI / PMID / arXiv ID / ISBN (POST /search, body = identifier). */
  async search(identifier: string): Promise<CaptureItem[]> {
    const response = await this.post("/search", identifier, "text/plain");
    return this.parseItemsResponse(response);
  }

  /**
   * Handle the translation-server "multiple choices" (300) response by
   * selecting the first candidate and re-posting the selection — single-paper
   * capture only needs one item.
   */
  private async resolveMultiple(response: Response): Promise<CaptureItem[]> {
    let payload: { items?: Record<string, string> } & Record<string, unknown>;
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      throw new TranslationNoResultError();
    }

    const itemMap = payload.items ?? {};
    const firstKey = Object.keys(itemMap)[0];
    if (!firstKey) {
      throw new TranslationNoResultError();
    }

    const selection = {
      ...payload,
      items: { [firstKey]: itemMap[firstKey] },
    };
    const resolved = await this.post(
      "/web",
      JSON.stringify(selection),
      "application/json"
    );
    return this.parseItemsResponse(resolved);
  }

  private async parseItemsResponse(response: Response): Promise<CaptureItem[]> {
    // 400/404 → translation-server could not recognise the input.
    if (response.status === 400 || response.status === 404) {
      throw new TranslationNoResultError();
    }
    if (!response.ok) {
      throw new TranslationUnavailableError(
        `Translation server error: ${response.status}`
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new TranslationNoResultError();
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new TranslationNoResultError();
    }

    return data.map((raw) => this.normalizeItem(raw as Record<string, unknown>));
  }

  private async post(
    path: string,
    body: string,
    contentType: string,
    attempt = 0
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          "User-Agent": "TypstScholarBackend/1.0",
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status >= 500 && attempt < this.maxRetries) {
        await this.delay(this.retryDelay * Math.pow(2, attempt));
        return this.post(path, body, contentType, attempt + 1);
      }
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (attempt < this.maxRetries) {
        await this.delay(this.retryDelay * Math.pow(2, attempt));
        return this.post(path, body, contentType, attempt + 1);
      }

      if ((error as Error).name === "AbortError") {
        throw new TranslationUnavailableError(
          "Translation server hết thời gian chờ"
        );
      }
      throw new TranslationUnavailableError(
        `Không thể kết nối translation server: ${(error as Error).message}`
      );
    }
  }

  /**
   * Normalize a translation-server item (Zotero API JSON, flat fields) into the
   * CaptureItem/ZoteroItem shape. translation-server returns fields at the top
   * level (itemType, title, creators, date, DOI, url, ...), so we copy the
   * known fields.
   */
  private normalizeItem(raw: Record<string, unknown>): CaptureItem {
    const r = raw as Record<string, any>;
    return {
      key: r.key ?? "",
      version: r.version ?? 0,
      itemType: r.itemType,
      title: r.title,
      creators: r.creators,
      date: r.date,
      publicationTitle: r.publicationTitle,
      volume: r.volume,
      issue: r.issue,
      pages: r.pages,
      DOI: r.DOI,
      ISSN: r.ISSN,
      publisher: r.publisher,
      place: r.place,
      edition: r.edition,
      numPages: r.numPages,
      ISBN: r.ISBN,
      proceedingsTitle: r.proceedingsTitle,
      conferenceName: r.conferenceName,
      university: r.university,
      thesisType: r.thesisType,
      institution: r.institution,
      reportNumber: r.reportNumber,
      reportType: r.reportType,
      url: r.url,
      accessDate: r.accessDate,
      websiteTitle: r.websiteTitle,
      abstractNote: r.abstractNote,
      language: r.language,
      rights: r.rights,
      extra: r.extra,
      tags: r.tags,
      collections: r.collections,
      relations: r.relations,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
