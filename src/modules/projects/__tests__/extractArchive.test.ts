import { describe, it } from 'node:test';
import assert from 'node:assert';
import AdmZip from 'adm-zip';
import {
  detectArchiveFormat,
  extractArchiveEntries,
  ArchiveExtractionError,
} from '../application/extractArchive.js';

const MAX_PER_FILE = 20 * 1024 * 1024;
const MAX_EXPANDED = 200 * 1024 * 1024;

// A real 2-file tar.gz (main.typ + chapters/intro.typ) captured from GNU tar,
// embedded so this test exercises the archive-wasm (LibArchive) path without
// depending on a `tar` CLI being present in CI.
const TGZ_BASE64 =
  'H4sIAAAAAAAAA+3VMQ6CMBTG8c6eosG99FXaTh7AYxAkQqKFQBm8vTBhUGNMKGj8fgtJl77kzwMRs+Bkz2rNpJFkNY3PESOtiBKlpLX9uSVjGdfhR2Osa33acM6KKnWnJS78LiLOirT2edOGexE+7k80HKH/Au76l843lfDXeu47hsAmSV73p2l/ZUzfX849yDN/3n/PD0P2zdpzwDpEfElLF2LrR2/3f2cm+y+Nxv4vYlu67Nwdcx49/gcifBUAAAAAAAAAAAAAAAAAAH7GDUEjdmQAKAAA';

function toMap(entries: { path: string; data: Buffer }[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of entries) map[e.path] = e.data.toString('utf-8');
  return map;
}

describe('detectArchiveFormat', () => {
  it('detects zip / rar / 7z / gzip / tar from magic bytes', () => {
    assert.strictEqual(detectArchiveFormat(Buffer.from([0x50, 0x4b, 0x03, 0x04])), 'zip');
    assert.strictEqual(
      detectArchiveFormat(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00])),
      'rar',
    );
    assert.strictEqual(detectArchiveFormat(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])), '7z');
    assert.strictEqual(detectArchiveFormat(Buffer.from([0x1f, 0x8b, 0x08])), 'gzip');
    const tar = Buffer.alloc(512);
    tar.write('ustar', 257, 'latin1');
    assert.strictEqual(detectArchiveFormat(tar), 'tar');
  });

  it('falls back to the extension when magic bytes are inconclusive', () => {
    assert.strictEqual(detectArchiveFormat(Buffer.from('x'), 'archive.7z'), '7z');
    assert.strictEqual(detectArchiveFormat(Buffer.from('x'), 'archive.rar'), 'rar');
    assert.strictEqual(detectArchiveFormat(Buffer.from('x'), 'archive.tar.gz'), 'gzip');
  });

  it('returns unknown for non-archive content', () => {
    assert.strictEqual(detectArchiveFormat(Buffer.from('just some plain text')), 'unknown');
  });
});

describe('extractArchiveEntries', () => {
  it('extracts a zip archive (adm-zip path)', () => {
    const zip = new AdmZip();
    zip.addFile('main.typ', Buffer.from('hello'));
    zip.addFile('chapters/intro.typ', Buffer.from('= Intro'));
    const map = toMap(
      extractArchiveEntries(zip.toBuffer(), 'p.zip', MAX_PER_FILE, MAX_EXPANDED),
    );
    assert.strictEqual(map['main.typ'], 'hello');
    assert.strictEqual(map['chapters/intro.typ'], '= Intro');
  });

  it('extracts a tar.gz archive (archive-wasm / LibArchive path)', () => {
    const buf = Buffer.from(TGZ_BASE64, 'base64');
    assert.strictEqual(detectArchiveFormat(buf), 'gzip');
    const map = toMap(extractArchiveEntries(buf, 'p.tar.gz', MAX_PER_FILE, MAX_EXPANDED));
    assert.ok(map['main.typ']?.includes('chapters/intro.typ'));
    assert.ok(map['chapters/intro.typ']?.includes('= Intro'));
  });

  it('throws UNSUPPORTED_ARCHIVE for non-archive input', () => {
    assert.throws(
      () => extractArchiveEntries(Buffer.from('not an archive'), 'x.bin', MAX_PER_FILE, MAX_EXPANDED),
      (e: unknown) => e instanceof ArchiveExtractionError && e.code === 'UNSUPPORTED_ARCHIVE',
    );
  });

  it('rejects an entry larger than the per-file cap (zip-bomb guard)', () => {
    const zip = new AdmZip();
    zip.addFile('big.bin', Buffer.alloc(1024));
    assert.throws(
      () => extractArchiveEntries(zip.toBuffer(), 'p.zip', 100, MAX_EXPANDED),
      (e: unknown) =>
        e instanceof ArchiveExtractionError && e.code === 'ZIP_PAYLOAD_TOO_LARGE',
    );
  });
});
