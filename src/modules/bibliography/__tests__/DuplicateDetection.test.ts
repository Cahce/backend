import test from "node:test";
import assert from "node:assert/strict";
import type { BibEntry } from "../domain/BibEntry.js";
import {
  analyzeDuplicateEntries,
  normalizeDoi,
} from "../domain/DuplicateDetection.js";

test("groups duplicate citation keys", () => {
  const groups = analyzeDuplicateEntries([
    entry("Smith2024", { title: "A", author: "Smith", year: "2024" }),
    entry("smith2024", { title: "B", author: "Jones", year: "2025" }),
  ]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].reasons, ["key"]);
  assert.deepEqual(
    groups[0].entries.map((item) => item.key),
    ["Smith2024", "smith2024"]
  );
});

test("normalizes DOI values before grouping", () => {
  assert.equal(normalizeDoi("https://doi.org/10.1000/XYZ "), "10.1000/xyz");
  assert.equal(normalizeDoi("doi: 10.1000/xyz"), "10.1000/xyz");

  const groups = analyzeDuplicateEntries([
    entry("A", { doi: "https://doi.org/10.1000/XYZ" }),
    entry("B", { doi: "doi:10.1000/xyz" }),
  ]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].reasons, ["doi"]);
});

test("groups normalized title-author-year duplicates", () => {
  const groups = analyzeDuplicateEntries([
    entry("A", {
      title: "{Learning Typst}: A Study",
      author: "Nguyen, An and Tran, Binh",
      year: "2024",
    }),
    entry("B", {
      title: "Learning Typst - a study",
      author: "An Nguyen",
      year: "2024-05-01",
    }),
  ]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].reasons, ["title_author_year"]);
});

test("can compare candidates against existing entries", () => {
  const groups = analyzeDuplicateEntries(
    [entry("Existing", { doi: "10.1000/example" })],
    {
      candidates: [entry("Incoming", { doi: "10.1000/example" })],
      matchBy: ["doi"],
    }
  );

  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].entries.map((item) => item.source),
    ["existing", "candidate"]
  );
});

function entry(key: string, fields: BibEntry["fields"]): BibEntry {
  return {
    key,
    type: "article",
    fields,
  };
}
