/**
 * Multi-format archive extraction for project import.
 *
 * Detects the archive format from magic bytes (with an extension fallback) and
 * yields every regular file as a `{ path, data }` entry. ZIP stays on
 * `adm-zip` — the existing, well-tested path. Everything else (7z, rar, tar,
 * tar.gz/tgz) goes through `archive-wasm` (LibArchive compiled to WASM, pure
 * JS, no native binary). Path-traversal, symlink, and size-bomb defenses are
 * applied uniformly to every format so the security posture matches the
 * original ZIP-only importer regardless of input format.
 *
 * Note: `archive-wasm` is GPL-3.0 licensed.
 */
import AdmZip from 'adm-zip';
import path from 'node:path';
import { extract as wasmExtract } from 'archive-wasm';
import { ProjectErrors } from '../domain/Project/Errors.js';

export interface PendingEntry {
  path: string;
  data: Buffer;
}

export type ArchiveFormat = 'zip' | 'rar' | '7z' | 'tar' | 'gzip' | 'unknown';

/** Thrown by extraction; carries a stable error code for HTTP mapping. */
export class ArchiveExtractionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ArchiveExtractionError';
  }
}

/** A format-agnostic archive entry. `getData` is lazy so callers can bail
 *  (path/size checks) before paying for a copy of the decompressed bytes. */
interface RawEntry {
  name: string;
  isDirectory: boolean;
  isSymlink: boolean;
  /** Declared uncompressed size when the format exposes it (pre-check). */
  declaredSize: number | null;
  getData: () => Buffer;
}

/**
 * Detect the archive format from leading magic bytes; fall back to the file
 * extension only when the bytes are inconclusive. Content is authoritative so
 * a `.zip` renamed to `.bak` (or vice-versa) still works and a spoofed
 * extension cannot pick the wrong extractor.
 */
export function detectArchiveFormat(buf: Buffer, filename?: string): ArchiveFormat {
  if (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)
  ) {
    return 'zip'; // PK\x03\x04 (also empty/spanned variants)
  }
  if (
    buf.length >= 6 &&
    buf[0] === 0x52 &&
    buf[1] === 0x61 &&
    buf[2] === 0x72 &&
    buf[3] === 0x21 &&
    buf[4] === 0x1a &&
    buf[5] === 0x07
  ) {
    return 'rar'; // "Rar!\x1a\x07" (RAR4 + RAR5)
  }
  if (
    buf.length >= 6 &&
    buf[0] === 0x37 &&
    buf[1] === 0x7a &&
    buf[2] === 0xbc &&
    buf[3] === 0xaf &&
    buf[4] === 0x27 &&
    buf[5] === 0x1c
  ) {
    return '7z'; // 7z\xbc\xaf\x27\x1c
  }
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return 'gzip'; // .gz / .tar.gz / .tgz
  }
  if (buf.length >= 262 && buf.toString('latin1', 257, 262) === 'ustar') {
    return 'tar';
  }

  const name = (filename ?? '').toLowerCase();
  if (name.endsWith('.zip')) return 'zip';
  if (name.endsWith('.rar')) return 'rar';
  if (name.endsWith('.7z')) return '7z';
  if (name.endsWith('.tar')) return 'tar';
  if (name.endsWith('.tar.gz') || name.endsWith('.tgz') || name.endsWith('.gz')) {
    return 'gzip';
  }
  return 'unknown';
}

function isUnsafePath(entryPath: string): boolean {
  // Normalise to POSIX separators (archives commonly use `/`).
  const normalised = entryPath.replace(/\\/g, '/');
  if (normalised.startsWith('/')) return true;
  if (/^[a-zA-Z]:[\\/]/.test(normalised)) return true; // Windows drive
  if (normalised.split('/').includes('..')) return true;
  return false;
}

function zipRawEntries(buffer: Buffer): RawEntry[] {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new ArchiveExtractionError(
      ProjectErrors.ZIP_MALFORMED.code,
      ProjectErrors.ZIP_MALFORMED.message,
    );
  }
  return zip.getEntries().map((entry) => {
    // Upper 16 bits of the external attributes are the UNIX mode; 0xA000 =
    // symlink. Skipped downstream — symlinks have no place in our editor.
    const unixMode = (entry.header.attr >>> 16) & 0xffff;
    return {
      name: entry.entryName,
      isDirectory: entry.isDirectory,
      isSymlink: (unixMode & 0xf000) === 0xa000,
      declaredSize:
        typeof entry.header.size === 'number' ? entry.header.size : null,
      getData: () => entry.getData(),
    };
  });
}

function* wasmRawEntries(buffer: Buffer, format: ArchiveFormat): Generator<RawEntry> {
  let iterator: Generator<{ path: string | null; type: string | null; size: bigint; data: ArrayBuffer }>;
  try {
    // normalize:false → keep raw paths so our own isUnsafePath check is the
    // single, consistent traversal gate across all formats.
    iterator = wasmExtract(buffer, {
      normalize: false,
      ignoreDotDir: true,
    }) as Generator<{ path: string | null; type: string | null; size: bigint; data: ArrayBuffer }>;
  } catch {
    throw new ArchiveExtractionError(
      ProjectErrors.ZIP_MALFORMED.code,
      `Không giải nén được tệp .${format}`,
    );
  }

  try {
    for (const entry of iterator) {
      // Copy out of WASM memory immediately — LibArchive may reuse the
      // backing buffer once the generator advances.
      const data = Buffer.from(entry.data);
      yield {
        name: entry.path ?? '',
        isDirectory: entry.type === 'DIR',
        isSymlink: entry.type === 'SYMBOLIC_LINK',
        declaredSize: typeof entry.size === 'bigint' ? Number(entry.size) : null,
        getData: () => data,
      };
    }
  } catch (err) {
    if (err instanceof ArchiveExtractionError) throw err;
    throw new ArchiveExtractionError(
      ProjectErrors.ZIP_MALFORMED.code,
      `Tệp .${format} bị lỗi hoặc không giải nén được`,
    );
  }
}

function collectEntries(
  raw: Iterable<RawEntry>,
  maxPerFileBytes: number,
  maxExpandedBytes: number,
): PendingEntry[] {
  const pending: PendingEntry[] = [];
  let totalExpanded = 0;

  for (const entry of raw) {
    if (entry.isDirectory || entry.isSymlink) continue;

    if (isUnsafePath(entry.name)) {
      throw new ArchiveExtractionError(
        ProjectErrors.ZIP_PATH_TRAVERSAL.code,
        `${ProjectErrors.ZIP_PATH_TRAVERSAL.message}: ${entry.name}`,
      );
    }

    const normalised = path.posix.normalize(entry.name).replace(/^\/+/, '');
    if (!normalised || normalised === '.' || normalised === '..') continue;

    // Fail fast on a declared oversized entry before decompressing/copying.
    if (entry.declaredSize != null && entry.declaredSize > maxPerFileBytes) {
      throw new ArchiveExtractionError(
        ProjectErrors.ZIP_PAYLOAD_TOO_LARGE.code,
        `${ProjectErrors.ZIP_PAYLOAD_TOO_LARGE.message} (${normalised} > ${maxPerFileBytes} bytes)`,
      );
    }

    const data = entry.getData();
    if (data.length > maxPerFileBytes) {
      throw new ArchiveExtractionError(
        ProjectErrors.ZIP_PAYLOAD_TOO_LARGE.code,
        `${ProjectErrors.ZIP_PAYLOAD_TOO_LARGE.message} (${normalised} > ${maxPerFileBytes} bytes)`,
      );
    }
    totalExpanded += data.length;
    if (totalExpanded > maxExpandedBytes) {
      throw new ArchiveExtractionError(
        ProjectErrors.ZIP_PAYLOAD_TOO_LARGE.code,
        `${ProjectErrors.ZIP_PAYLOAD_TOO_LARGE.message} (tổng > ${maxExpandedBytes} bytes)`,
      );
    }

    pending.push({ path: normalised, data });
  }

  return pending;
}

/**
 * Extract every regular file from a supported archive into `{ path, data }`
 * entries, enforcing path-traversal, symlink and size-bomb defenses. Throws
 * {@link ArchiveExtractionError} (with a `ProjectErrors` code) on any failure.
 */
export function extractArchiveEntries(
  buffer: Buffer,
  filename: string | undefined,
  maxPerFileBytes: number,
  maxExpandedBytes: number,
): PendingEntry[] {
  const format = detectArchiveFormat(buffer, filename);
  if (format === 'unknown') {
    throw new ArchiveExtractionError(
      ProjectErrors.UNSUPPORTED_ARCHIVE.code,
      ProjectErrors.UNSUPPORTED_ARCHIVE.message,
    );
  }
  const raw =
    format === 'zip' ? zipRawEntries(buffer) : wasmRawEntries(buffer, format);
  return collectEntries(raw, maxPerFileBytes, maxExpandedBytes);
}
