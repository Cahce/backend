import { describe, it } from "node:test";
import assert from "node:assert";
import { detectBibFormat, isBibliographyPath } from "../domain/BibliographyPath.js";

describe("detectBibFormat", () => {
  it("returns 'bibtex' for .bib", () => {
    assert.strictEqual(detectBibFormat("ref.bib"), "bibtex");
    assert.strictEqual(detectBibFormat("a/b/c.bib"), "bibtex");
  });

  it("returns 'hayagriva' for .yml and .yaml", () => {
    assert.strictEqual(detectBibFormat("ref.yml"), "hayagriva");
    assert.strictEqual(detectBibFormat("ref.yaml"), "hayagriva");
    assert.strictEqual(detectBibFormat("nested/path.YAML"), "hayagriva");
  });

  it("is case-insensitive", () => {
    assert.strictEqual(detectBibFormat("REF.BIB"), "bibtex");
    assert.strictEqual(detectBibFormat("Ref.Yml"), "hayagriva");
  });

  it("returns null for unrelated extensions", () => {
    assert.strictEqual(detectBibFormat("main.typ"), null);
    assert.strictEqual(detectBibFormat("logo.png"), null);
    assert.strictEqual(detectBibFormat("project.toml"), null);
    assert.strictEqual(detectBibFormat("notes.txt"), null);
  });

  it("returns null for paths without extension", () => {
    assert.strictEqual(detectBibFormat("README"), null);
    assert.strictEqual(detectBibFormat(""), null);
  });
});

describe("isBibliographyPath", () => {
  it("matches detectBibFormat", () => {
    assert.strictEqual(isBibliographyPath("ref.bib"), true);
    assert.strictEqual(isBibliographyPath("ref.yml"), true);
    assert.strictEqual(isBibliographyPath("ref.yaml"), true);
    assert.strictEqual(isBibliographyPath("ref.txt"), false);
    assert.strictEqual(isBibliographyPath(""), false);
  });
});
