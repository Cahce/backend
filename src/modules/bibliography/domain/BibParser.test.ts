/**
 * BibTeX Parser Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBib } from "./BibParser.js";
import { serializeBib } from "./BibSerializer.js";

describe("parseBib", () => {
  it("should parse a simple article entry", () => {
    const bibtex = `
@article{Smith2024Machine,
  title = {Machine Learning Basics},
  author = {Smith, John},
  year = {2024},
  journal = {AI Review}
}
    `.trim();

    const entries = parseBib(bibtex);

    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].key, "Smith2024Machine");
    assert.strictEqual(entries[0].type, "article");
    assert.strictEqual(entries[0].fields.title, "Machine Learning Basics");
    assert.strictEqual(entries[0].fields.author, "Smith, John");
    assert.strictEqual(entries[0].fields.year, "2024");
    assert.strictEqual(entries[0].fields.journal, "AI Review");
  });

  it("should parse a book entry", () => {
    const bibtex = `
@book{Jones2023Deep,
  title = {Deep Learning},
  author = {Jones, Alice},
  year = {2023},
  publisher = {Tech Press}
}
    `.trim();

    const entries = parseBib(bibtex);

    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].type, "book");
    assert.strictEqual(entries[0].fields.publisher, "Tech Press");
  });

  it("should parse multiple entries", () => {
    const bibtex = `
@article{Entry1,
  title = {First}
}

@book{Entry2,
  title = {Second}
}
    `.trim();

    const entries = parseBib(bibtex);

    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].key, "Entry1");
    assert.strictEqual(entries[1].key, "Entry2");
  });

  it("should handle multi-line field values", () => {
    const bibtex = `
@article{Test2024,
  title = {This is a very long title
    that spans multiple lines
    for testing purposes}
}
    `.trim();

    const entries = parseBib(bibtex);

    assert.strictEqual(entries.length, 1);
    assert.ok(entries[0].fields.title?.includes("very long title"));
    assert.ok(entries[0].fields.title?.includes("multiple lines"));
  });

  it("should unescape special characters", () => {
    const bibtex = `
@article{Test2024,
  title = {Test \\& Validation \\{with braces\\}},
  author = {Test\\_Author},
  note = {Cost: \\$100, 50\\% off}
}
    `.trim();

    const entries = parseBib(bibtex);

    assert.strictEqual(entries[0].fields.title, "Test & Validation {with braces}");
    assert.strictEqual(entries[0].fields.author, "Test_Author");
    assert.strictEqual(entries[0].fields.note, "Cost: $100, 50% off");
  });

  it("should skip comments outside entries", () => {
    const bibtex = `
% This is a comment
@article{Test2024,
  title = {Test}
}
% Another comment
    `.trim();

    const entries = parseBib(bibtex);

    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].key, "Test2024");
  });

  it("should handle empty input", () => {
    const entries = parseBib("");
    assert.strictEqual(entries.length, 0);
  });

  it("should handle entry with trailing comma", () => {
    const bibtex = `
@article{Test2024,
  title = {Test},
  author = {Author},
}
    `.trim();

    const entries = parseBib(bibtex);

    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].fields.title, "Test");
    assert.strictEqual(entries[0].fields.author, "Author");
  });

  it("should round-trip with serializer (article)", () => {
    const original = `
@article{Smith2024Machine,
  title = {Machine Learning Basics},
  author = {Smith, John},
  year = {2024},
  journal = {AI Review}
}
    `.trim();

    const parsed = parseBib(original);
    const serialized = serializeBib(parsed);
    const reparsed = parseBib(serialized);

    assert.strictEqual(reparsed.length, 1);
    assert.strictEqual(reparsed[0].key, parsed[0].key);
    assert.strictEqual(reparsed[0].type, parsed[0].type);
    assert.strictEqual(reparsed[0].fields.title, parsed[0].fields.title);
    assert.strictEqual(reparsed[0].fields.author, parsed[0].fields.author);
  });

  it("should round-trip with serializer (book)", () => {
    const original = `
@book{Jones2023Deep,
  title = {Deep Learning},
  author = {Jones, Alice},
  year = {2023},
  publisher = {Tech Press}
}
    `.trim();

    const parsed = parseBib(original);
    const serialized = serializeBib(parsed);
    const reparsed = parseBib(serialized);

    assert.strictEqual(reparsed.length, 1);
    assert.strictEqual(reparsed[0].fields.publisher, "Tech Press");
  });

  it("should round-trip with serializer (incollection)", () => {
    const original = `
@incollection{Brown2022Chapter,
  title = {Advanced Topics},
  author = {Brown, Bob},
  booktitle = {Handbook of AI},
  year = {2022},
  pages = {100-150}
}
    `.trim();

    const parsed = parseBib(original);
    const serialized = serializeBib(parsed);
    const reparsed = parseBib(serialized);

    assert.strictEqual(reparsed.length, 1);
    assert.strictEqual(reparsed[0].type, "incollection");
    assert.strictEqual(reparsed[0].fields.booktitle, "Handbook of AI");
    assert.strictEqual(reparsed[0].fields.pages, "100-150");
  });
});
