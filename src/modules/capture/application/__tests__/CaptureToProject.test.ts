import { test } from "node:test";
import assert from "node:assert/strict";
import { CaptureToProject } from "../CaptureToProject.js";
import type { CaptureItem } from "../../domain/Types.js";

const sampleItem = {
  key: "",
  version: 0,
  itemType: "journalArticle",
  title: "Attention Is All You Need",
  creators: [{ creatorType: "author", firstName: "Ashish", lastName: "Vaswani" }],
  date: "2017",
  DOI: "10.5555/3295222.3295349",
} as CaptureItem;

function makeBib(existing: any[] = []) {
  const writes: any[][] = [];
  return {
    writes,
    service: {
      readBibFile: async () => existing,
      mergeEntries: (a: any[], b: any[]) => [...a, ...b],
      writeBibFile: async (_p: string, _path: string, entries: any[]) => {
        writes.push(entries);
      },
    },
  };
}

const allowAccess = { requireWriteAccess: async () => {} };
const translation = {
  web: async () => [sampleItem],
  search: async () => [sampleItem],
};

test("saves to .bib and returns a citation key", async () => {
  const bib = makeBib();
  const writer = { saveItems: async () => ({ keys: [] as string[] }) };
  const uc = new CaptureToProject(
    translation as any,
    bib.service as any,
    allowAccess as any,
    writer as any
  );
  const res = await uc.execute({
    userId: "u1",
    projectId: "p1",
    identifier: "10.5555/3295222.3295349",
    targetBibPath: "bibliography.bib",
    saveToBib: true,
    saveToZotero: false,
  });
  assert.equal(res.bibSaved, true);
  assert.ok(res.citationKey.length > 0);
  assert.equal(bib.writes.length, 1);
});

test("skips duplicate by DOI without writing", async () => {
  const existing = [
    {
      key: "Vaswani2017Attention",
      type: "article",
      fields: { doi: "10.5555/3295222.3295349" },
    },
  ];
  const bib = makeBib(existing);
  const writer = { saveItems: async () => ({ keys: [] as string[] }) };
  const uc = new CaptureToProject(
    translation as any,
    bib.service as any,
    allowAccess as any,
    writer as any
  );
  const res = await uc.execute({
    userId: "u1",
    projectId: "p1",
    identifier: "x",
    targetBibPath: "bibliography.bib",
    saveToBib: true,
    saveToZotero: false,
  });
  assert.equal(res.bibSaved, false);
  assert.equal(res.skippedDuplicate?.existingKey, "Vaswani2017Attention");
  assert.equal(bib.writes.length, 0);
});

test("saves to Zotero and returns the item key", async () => {
  const bib = makeBib();
  const writer = { saveItems: async () => ({ keys: ["ABCD1234"] }) };
  const uc = new CaptureToProject(
    translation as any,
    bib.service as any,
    allowAccess as any,
    writer as any
  );
  const res = await uc.execute({
    userId: "u1",
    projectId: "p1",
    url: "https://arxiv.org/abs/1706.03762",
    targetBibPath: "bibliography.bib",
    saveToBib: false,
    saveToZotero: true,
  });
  assert.equal(res.zoteroItemKey, "ABCD1234");
  assert.equal(res.bibSaved, false);
});

test("throws when no save target is selected", async () => {
  const bib = makeBib();
  const writer = { saveItems: async () => ({ keys: [] as string[] }) };
  const uc = new CaptureToProject(
    translation as any,
    bib.service as any,
    allowAccess as any,
    writer as any
  );
  await assert.rejects(() =>
    uc.execute({
      userId: "u1",
      projectId: "p1",
      identifier: "x",
      targetBibPath: "bibliography.bib",
      saveToBib: false,
      saveToZotero: false,
    })
  );
});

test("throws no-result when translation returns nothing", async () => {
  const bib = makeBib();
  const empty = { web: async () => [], search: async () => [] };
  const writer = { saveItems: async () => ({ keys: [] as string[] }) };
  const uc = new CaptureToProject(
    empty as any,
    bib.service as any,
    allowAccess as any,
    writer as any
  );
  await assert.rejects(() =>
    uc.execute({
      userId: "u1",
      projectId: "p1",
      identifier: "x",
      targetBibPath: "bibliography.bib",
      saveToBib: true,
      saveToZotero: false,
    })
  );
});
