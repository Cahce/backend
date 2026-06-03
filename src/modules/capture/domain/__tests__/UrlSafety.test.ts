import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPublicHttpUrl, UnsafeUrlError } from "../UrlSafety.js";

test("allows a public https url", () => {
  const u = assertPublicHttpUrl("https://arxiv.org/abs/1706.03762");
  assert.equal(u.hostname, "arxiv.org");
});

test("allows a public http url", () => {
  assert.equal(assertPublicHttpUrl("http://example.com/x").protocol, "http:");
});

const unsafe = [
  "http://127.0.0.1/x",
  "http://localhost/x",
  "http://192.168.1.5/x",
  "http://10.0.0.1/x",
  "http://172.16.0.1/x",
  "http://169.254.169.254/latest/meta-data",
  "http://[::1]/x",
  "ftp://example.com/x",
  "file:///etc/passwd",
  "http://router/x",
  "https://user:pass@example.com/x",
  "not a url",
];

for (const url of unsafe) {
  test(`rejects ${url}`, () => {
    assert.throws(() => assertPublicHttpUrl(url), UnsafeUrlError);
  });
}
