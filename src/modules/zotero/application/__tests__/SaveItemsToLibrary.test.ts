import { test } from "node:test";
import assert from "node:assert/strict";
import { SaveItemsToLibrary } from "../SaveItemsToLibrary.js";
import {
  ZoteroNotConnectedError,
  ZoteroWriteForbiddenError,
} from "../../domain/Errors.js";

const conn = {
  id: "c1",
  userId: "u1",
  accessToken: "key",
  libraryId: "123",
  libraryType: "user" as const,
  connectedAt: new Date(),
  lastSyncedAt: null,
};

function repo(value: any) {
  return {
    getByUserId: async () => value,
    upsert: async () => value,
    deleteByUserId: async () => {},
    touchLastSyncedAt: async () => {},
  };
}

function api(write: boolean, keys: string[] = ["NEWKEY"]) {
  return {
    getKeyInfo: async () => ({
      userId: "123",
      username: "u",
      access: { user: { write } },
    }),
    createItems: async () => ({ successKeys: keys, failed: [] }),
  };
}

test("writes items when the key has write scope", async () => {
  const uc = new SaveItemsToLibrary(repo(conn) as any, api(true) as any);
  const res = await uc.execute({
    userId: "u1",
    items: [{ itemType: "journalArticle" } as any],
  });
  assert.deepEqual(res.keys, ["NEWKEY"]);
});

test("throws when Zotero is not connected", async () => {
  const uc = new SaveItemsToLibrary(repo(null) as any, api(true) as any);
  await assert.rejects(
    () => uc.execute({ userId: "u1", items: [{ itemType: "x" } as any] }),
    ZoteroNotConnectedError
  );
});

test("throws when the key has no write scope", async () => {
  const uc = new SaveItemsToLibrary(repo(conn) as any, api(false) as any);
  await assert.rejects(
    () => uc.execute({ userId: "u1", items: [{ itemType: "x" } as any] }),
    ZoteroWriteForbiddenError
  );
});

test("returns empty and skips the API for an empty item list", async () => {
  let called = false;
  const spyApi = {
    ...api(true),
    getKeyInfo: async () => {
      called = true;
      return { userId: "1", username: "", access: {} };
    },
  };
  const uc = new SaveItemsToLibrary(repo(conn) as any, spyApi as any);
  const res = await uc.execute({ userId: "u1", items: [] });
  assert.deepEqual(res.keys, []);
  assert.equal(called, false);
});
