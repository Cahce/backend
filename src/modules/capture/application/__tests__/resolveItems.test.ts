import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveReferenceItems } from "../resolveItems.js";
import {
  TranslationUnavailableError,
  TranslationNoResultError,
  CaptureInvalidInputError,
} from "../../domain/Errors.js";

const sample = { key: "", version: 0, itemType: "journalArticle", title: "X" } as any;

test("identifier: uses translation-server result when available", async () => {
  const translation = { web: async () => [], search: async () => [sample] };
  const items = await resolveReferenceItems(translation as any, null, {
    identifier: "10.1/x",
  });
  assert.equal(items.length, 1);
});

test("identifier: falls back to OpenAlex when translation-server is unavailable", async () => {
  const translation = {
    web: async () => [],
    search: async () => {
      throw new TranslationUnavailableError();
    },
  };
  const fallback = { resolveIdentifier: async () => sample };
  const items = await resolveReferenceItems(translation as any, fallback as any, {
    identifier: "10.1/x",
  });
  assert.equal(items.length, 1);
});

test("identifier: falls back to OpenAlex on no-result", async () => {
  const translation = {
    web: async () => [],
    search: async () => {
      throw new TranslationNoResultError();
    },
  };
  const fallback = { resolveIdentifier: async () => sample };
  const items = await resolveReferenceItems(translation as any, fallback as any, {
    identifier: "10.1/x",
  });
  assert.equal(items.length, 1);
});

test("identifier: rethrows when fallback also fails", async () => {
  const translation = {
    web: async () => [],
    search: async () => {
      throw new TranslationUnavailableError();
    },
  };
  const fallback = { resolveIdentifier: async () => null };
  await assert.rejects(
    () =>
      resolveReferenceItems(translation as any, fallback as any, {
        identifier: "x",
      }),
    TranslationUnavailableError
  );
});

test("url: uses translation-server only (no OpenAlex fallback)", async () => {
  let webCalled = false;
  const translation = {
    web: async () => {
      webCalled = true;
      return [sample];
    },
    search: async () => [],
  };
  const fallback = { resolveIdentifier: async () => sample };
  const items = await resolveReferenceItems(translation as any, fallback as any, {
    url: "https://arxiv.org/abs/1706.03762",
  });
  assert.equal(webCalled, true);
  assert.equal(items.length, 1);
});

test("rejects when neither url nor identifier is provided", async () => {
  const translation = { web: async () => [], search: async () => [] };
  await assert.rejects(
    () => resolveReferenceItems(translation as any, null, {}),
    CaptureInvalidInputError
  );
});
