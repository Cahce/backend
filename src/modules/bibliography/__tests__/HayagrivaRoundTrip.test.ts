import { describe, it } from "node:test";
import assert from "node:assert";
import { parseHayagriva } from "../domain/HayagrivaParser.js";
import { serializeHayagriva } from "../domain/HayagrivaSerializer.js";
import type { BibEntry } from "../domain/BibEntry.js";

/**
 * Round-trip: BibEntry → serialize → parse → BibEntry, must preserve data.
 * Tests cover all 8 BibEntryType + edge cases.
 */
describe("Hayagriva round-trip", () => {
  const fixtures: BibEntry[] = [
    {
      key: "smith2024",
      type: "article",
      fields: {
        title: "Machine Learning in Practice",
        author: "Smith, John and Doe, Jane",
        year: "2024",
        journal: "Nature Machine Intelligence",
        volume: "6",
        number: "2",
        pages: "145-159",
        doi: "10.1038/s42256-024-00815-9",
      },
    },
    {
      key: "knuth1984",
      type: "book",
      fields: {
        title: "The Art of Computer Programming",
        author: "Knuth, Donald E.",
        year: "1984",
        publisher: "Addison-Wesley",
        address: "Reading, MA",
        edition: "3",
        isbn: "0-201-03801-6",
      },
    },
    {
      key: "lecun2015",
      type: "inproceedings",
      fields: {
        title: "Deep Learning",
        author: "LeCun, Yann and Bengio, Yoshua",
        year: "2015",
        booktitle: "Proceedings of ICML",
        pages: "1200-1220",
      },
    },
    {
      key: "ch",
      type: "incollection",
      fields: {
        title: "A Chapter",
        author: "Author, A.",
        year: "2020",
        booktitle: "Handbook of Examples",
        publisher: "Example Press",
        pages: "10-20",
      },
    },
    {
      key: "reynolds2020",
      type: "phdthesis",
      fields: {
        title: "Advanced Topics in Bibliography",
        author: "Reynolds, Claire",
        year: "2020",
        publisher: "MIT",
      },
    },
    {
      key: "techreport-x",
      type: "techreport",
      fields: {
        title: "A Technical Report",
        author: "Engineer, E.",
        year: "2019",
        publisher: "Acme R&D",
      },
    },
    {
      key: "webpage-1",
      type: "misc",
      fields: {
        title: "An Article on the Web",
        url: "https://example.com",
        year: "2024",
      },
    },
    {
      key: "with-month",
      type: "article",
      fields: {
        title: "Monthly News",
        author: "News, N.",
        year: "2023",
        month: "march",
        journal: "Monthly",
      },
    },
  ];

  for (const original of fixtures) {
    it(`preserves ${original.key} (${original.type})`, () => {
      const yaml = serializeHayagriva([original]);
      const [reparsed] = parseHayagriva(yaml);
      assert.ok(reparsed, "parser must return at least one entry");
      assert.strictEqual(reparsed.key, original.key);
      assert.strictEqual(reparsed.type, original.type);
      for (const [field, value] of Object.entries(original.fields)) {
        if (value === undefined) continue;
        // Skip month for the with-month case — Hayagriva stores it inside
        // `date` as "YYYY-MM", and the reverse parser normalises month back
        // to its numeric string ("3" not "march"). Round-trip preserves the
        // information, just in a normalised form.
        if (field === "month") {
          assert.strictEqual(reparsed.fields.month, "3");
          continue;
        }
        assert.strictEqual(
          reparsed.fields[field as keyof typeof reparsed.fields],
          value,
          `field ${field} should round-trip`,
        );
      }
    });
  }

  it("preserves the full fixture list as one document", () => {
    const yaml = serializeHayagriva(fixtures);
    const reparsed = parseHayagriva(yaml);
    assert.strictEqual(reparsed.length, fixtures.length);
    for (let i = 0; i < fixtures.length; i++) {
      assert.strictEqual(reparsed[i].key, fixtures[i].key);
      assert.strictEqual(reparsed[i].type, fixtures[i].type);
    }
  });
});
