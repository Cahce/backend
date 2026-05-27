import { describe, it } from "node:test";
import assert from "node:assert";
import { parseHayagriva } from "../domain/HayagrivaParser.js";

describe("parseHayagriva", () => {
  it("returns [] for malformed YAML without throwing", () => {
    const out = parseHayagriva("::not yaml::");
    assert.deepStrictEqual(out, []);
  });

  it("returns [] for non-object top-level", () => {
    assert.deepStrictEqual(parseHayagriva("just a string"), []);
    assert.deepStrictEqual(parseHayagriva("[1, 2, 3]"), []);
  });

  it("parses a journal article", () => {
    const yaml = `
clark1988:
  type: article
  title: "Error-correction coding"
  author:
    - "Clark, George C."
    - "Cain, Joseph B."
  date: 1988
  page-range: "145-159"
  serial-number:
    doi: "10.1109/26.2755"
  parent:
    type: periodical
    title: "IEEE Transactions"
    volume: 36
    issue: 2
`;
    const [e] = parseHayagriva(yaml);
    assert.strictEqual(e.key, "clark1988");
    assert.strictEqual(e.type, "article");
    assert.strictEqual(e.fields.title, "Error-correction coding");
    assert.strictEqual(e.fields.author, "Clark, George C. and Cain, Joseph B.");
    assert.strictEqual(e.fields.year, "1988");
    assert.strictEqual(e.fields.pages, "145-159");
    assert.strictEqual(e.fields.doi, "10.1109/26.2755");
    assert.strictEqual(e.fields.journal, "IEEE Transactions");
    assert.strictEqual(e.fields.volume, "36");
    assert.strictEqual(e.fields.number, "2");
  });

  it("parses a book", () => {
    const yaml = `
knuth1984:
  type: book
  title: "The Art of Computer Programming"
  author: ["Knuth, Donald E."]
  date: 1984
  publisher: "Addison-Wesley"
  location: "Reading, MA"
  edition: 3
  serial-number:
    isbn: "0-201-03801-6"
`;
    const [e] = parseHayagriva(yaml);
    assert.strictEqual(e.type, "book");
    assert.strictEqual(e.fields.publisher, "Addison-Wesley");
    assert.strictEqual(e.fields.address, "Reading, MA");
    assert.strictEqual(e.fields.edition, "3");
    assert.strictEqual(e.fields.isbn, "0-201-03801-6");
  });

  it("reverses inproceedings via parent.type=proceedings", () => {
    const yaml = `
lecun2015:
  type: article
  title: "Deep Learning"
  parent:
    type: proceedings
    title: "Proceedings of ICML"
`;
    const [e] = parseHayagriva(yaml);
    assert.strictEqual(e.type, "inproceedings");
    assert.strictEqual(e.fields.booktitle, "Proceedings of ICML");
    assert.strictEqual(e.fields.journal, undefined);
  });

  it("reverses incollection via type=chapter", () => {
    const yaml = `
ch:
  type: chapter
  title: "A Chapter"
  parent:
    type: anthology
    title: "An Anthology"
`;
    const [e] = parseHayagriva(yaml);
    assert.strictEqual(e.type, "incollection");
    assert.strictEqual(e.fields.booktitle, "An Anthology");
  });

  it("reverses thesis", () => {
    const yaml = `
reynolds2020:
  type: thesis
  title: "A Thesis"
  publisher: "MIT"
`;
    const [e] = parseHayagriva(yaml);
    assert.strictEqual(e.type, "phdthesis");
  });

  it("parses YYYY-MM date back to year + month", () => {
    const yaml = `
k:
  type: misc
  title: t
  date: "2024-03"
`;
    const [e] = parseHayagriva(yaml);
    assert.strictEqual(e.fields.year, "2024");
    assert.strictEqual(e.fields.month, "3");
  });

  it("skips malformed entries but keeps good ones", () => {
    const yaml = `
good:
  type: misc
  title: ok
bad: "not a map"
`;
    const entries = parseHayagriva(yaml);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].key, "good");
  });

  it("accepts person object form { given-name, name }", () => {
    const yaml = `
k:
  type: article
  title: t
  author:
    - given-name: John
      name: Smith
    - "Doe, Jane"
`;
    const [e] = parseHayagriva(yaml);
    assert.strictEqual(e.fields.author, "Smith, John and Doe, Jane");
  });

  it("accepts url object form { value }", () => {
    const yaml = `
k:
  type: misc
  title: t
  url:
    value: "https://example.com"
    date: 2024
`;
    const [e] = parseHayagriva(yaml);
    assert.strictEqual(e.fields.url, "https://example.com");
  });
});
