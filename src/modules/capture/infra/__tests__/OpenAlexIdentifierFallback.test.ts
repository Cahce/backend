import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeToDoi } from "../OpenAlexIdentifierFallback.js";

test("keeps a bare DOI", () => {
  assert.equal(normalizeToDoi("10.1038/nphys1170"), "10.1038/nphys1170");
});

test("strips a doi.org URL", () => {
  assert.equal(
    normalizeToDoi("https://doi.org/10.1038/nphys1170"),
    "10.1038/nphys1170"
  );
});

test("strips a doi: prefix", () => {
  assert.equal(normalizeToDoi("doi:10.1038/nphys1170"), "10.1038/nphys1170");
});

test("maps a new-style arXiv id to its DOI", () => {
  assert.equal(normalizeToDoi("2301.01234"), "10.48550/arXiv.2301.01234");
  assert.equal(normalizeToDoi("arXiv:1706.03762v5"), "10.48550/arXiv.1706.03762");
});

test("maps an arXiv abs URL to its DOI", () => {
  assert.equal(
    normalizeToDoi("https://arxiv.org/abs/1706.03762"),
    "10.48550/arXiv.1706.03762"
  );
});

test("returns null for identifiers it can't turn into a DOI", () => {
  assert.equal(normalizeToDoi("978-3-16-148410-0"), null); // ISBN
  assert.equal(normalizeToDoi("hello world"), null);
});
