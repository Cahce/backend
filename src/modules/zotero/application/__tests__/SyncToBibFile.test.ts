/**
 * Unit test for SyncToBibFile — guards the itemKeys N+1 fix: selecting specific
 * Zotero items must issue ONE batched getItemsByKeys call, never one getItem per
 * key. Uses `as any` mocks (matching the SaveItemsToLibrary test style); items
 * are returned empty so the test exercises only the fetch path.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { SyncToBibFile } from "../SyncToBibFile.js";

const conn = {
  id: "c1",
  userId: "u1",
  accessToken: "key",
  libraryId: "123",
  libraryType: "user" as const,
  connectedAt: new Date(),
  lastSyncedAt: null,
};

test("itemKeys sync uses ONE batched getItemsByKeys call, never per-item getItem", async () => {
  let getItemsByKeysCalls = 0;
  let receivedKeys: string[] = [];
  let getItemCalls = 0;

  const apiClient = {
    getItem: async () => {
      getItemCalls++;
      throw new Error("must not call getItem on the itemKeys path");
    },
    getItemsByKeys: async (_libraryType: string, _libraryId: string, keys: string[]) => {
      getItemsByKeysCalls++;
      receivedKeys = keys;
      return []; // empty → skip mapping/write, exercise only the fetch path
    },
  };

  const bibliography = {
    readBibFile: async () => [],
    mergeEntries: (_existing: unknown, incoming: unknown[]) => incoming,
    writeBibFile: async () => {
      throw new Error("must not write the bib file when no items returned");
    },
  };

  const connRepo = {
    getByUserId: async () => conn,
    touchLastSyncedAt: async () => {},
  };

  let markedSuccessWith: number | null = null;
  const logRepo = {
    create: async () => ({ id: "log1" }),
    markRunning: async () => {},
    markSuccess: async (_id: string, n: number) => {
      markedSuccessWith = n;
    },
    markFailed: async () => {},
  };

  const projectAccess = { requireWriteAccess: async () => {} };

  const uc = new SyncToBibFile(
    connRepo as any,
    apiClient as any,
    bibliography as any,
    logRepo as any,
    projectAccess as any,
  );

  const res = await uc.execute({
    userId: "u1",
    projectId: "p1",
    targetBibPath: "refs.bib",
    syncType: "incremental",
    itemKeys: ["K1", "K2", "K3"],
    conflictMode: "skip",
  });

  assert.equal(getItemsByKeysCalls, 1);
  assert.deepEqual(receivedKeys, ["K1", "K2", "K3"]);
  assert.equal(getItemCalls, 0);
  assert.equal(res.itemsSynced, 0);
  assert.equal(markedSuccessWith, 0);
});
