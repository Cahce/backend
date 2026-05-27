/**
 * Bilingual header normalization + small import helpers.
 *
 * Spreadsheet import files in this project may carry either English internal
 * keys (legacy CSV / English templates) or the Vietnamese headers used in the
 * downloadable templates (e.g. "Mã khoa", "Họ và Tên"). The Zod schemas in
 * each Import<Resource>.ts use case operate on English keys only, so rows are
 * normalized through `normalizeRow` before validation.
 */

export type HeaderMap = Record<string, string>;

/**
 * Map Vietnamese / aliased header keys onto internal English keys.
 *
 * - Match is case-insensitive and whitespace-trimmed against the headerMap.
 * - Keys not present in the map are kept as-is so existing English-keyed rows
 *   still validate.
 * - Empty-string values become `undefined` so Zod `.optional()` works.
 * - Non-string keys (defensive) are silently dropped.
 */
export function normalizeRow(
  row: Record<string, unknown>,
  headerMap: HeaderMap,
): Record<string, unknown> {
  const lookup = new Map<string, string>();
  for (const [src, dst] of Object.entries(headerMap)) {
    lookup.set(src.trim().toLowerCase(), dst);
  }

  const out: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(row)) {
    if (typeof rawKey !== "string") continue;
    const normalizedKey =
      lookup.get(rawKey.trim().toLowerCase()) ?? rawKey;
    const value =
      typeof rawValue === "string" && rawValue.trim() === ""
        ? undefined
        : typeof rawValue === "string"
          ? rawValue.trim()
          : rawValue;
    if (value === undefined) continue;
    out[normalizedKey] = value;
  }
  return out;
}

/**
 * Extract the alphanumeric local-part of an email and lower-case it.
 * Used as fallback for teacher code generation when DB has no pattern yet.
 *
 * "Kieu.Tuan-Dung@tlu.edu.vn" -> "kieutuandung"
 */
export function slugFromEmailLocal(email: string): string {
  const at = email.indexOf("@");
  const local = at === -1 ? email : email.slice(0, at);
  return local.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

const CODE_PATTERN = /^([A-Za-z]+)(\d+)$/;

/**
 * Stateful generator that produces the next sequential code in the dominant
 * `<prefix><digits>` pattern observed in the existing codes.
 *
 * - Empty input → starts at "GV001".
 * - Mixed prefixes → picks the most frequent prefix; ties broken by lexicographic order.
 * - Digit width is the max width seen for the chosen prefix.
 * - Codes that don't match the pattern are ignored when picking prefix/max.
 *
 * Call `next()` to consume the current candidate and advance the counter;
 * call `peek()` to inspect without advancing. `reserve(code)` marks a code as
 * taken so subsequent `next()` calls skip past it — useful when a row already
 * provided a code that happens to land in our generated range.
 */
export class SequentialCodeGenerator {
  private readonly prefix: string;
  private readonly width: number;
  private current: number;
  private readonly taken: Set<string>;

  constructor(existingCodes: ReadonlyArray<string>) {
    const buckets = new Map<string, { max: number; width: number; count: number }>();
    for (const raw of existingCodes) {
      const match = CODE_PATTERN.exec(raw ?? "");
      if (!match) continue;
      const prefix = match[1].toUpperCase();
      const digits = match[2];
      const value = Number.parseInt(digits, 10);
      if (!Number.isFinite(value)) continue;
      const bucket = buckets.get(prefix);
      if (bucket) {
        bucket.max = Math.max(bucket.max, value);
        bucket.width = Math.max(bucket.width, digits.length);
        bucket.count++;
      } else {
        buckets.set(prefix, { max: value, width: digits.length, count: 1 });
      }
    }

    let bestPrefix = "GV";
    let bestBucket = { max: 0, width: 3, count: 0 };
    for (const [prefix, bucket] of buckets) {
      if (
        bucket.count > bestBucket.count ||
        (bucket.count === bestBucket.count && prefix < bestPrefix)
      ) {
        bestPrefix = prefix;
        bestBucket = bucket;
      }
    }

    this.prefix = bestPrefix;
    this.width = bestBucket.width;
    this.current = bestBucket.max;
    this.taken = new Set(existingCodes.map((c) => c.toUpperCase()));
  }

  peek(): string {
    let n = this.current + 1;
    while (this.taken.has(this.format(n))) {
      n++;
    }
    return this.format(n);
  }

  next(): string {
    let n = this.current + 1;
    while (this.taken.has(this.format(n))) {
      n++;
    }
    this.current = n;
    const code = this.format(n);
    this.taken.add(code.toUpperCase());
    return code;
  }

  reserve(code: string): void {
    this.taken.add(code.toUpperCase());
    const match = CODE_PATTERN.exec(code);
    if (match && match[1].toUpperCase() === this.prefix) {
      const value = Number.parseInt(match[2], 10);
      if (Number.isFinite(value) && value > this.current) {
        this.current = value;
      }
    }
  }

  private format(n: number): string {
    return `${this.prefix}${String(n).padStart(this.width, "0")}`;
  }
}

/**
 * One-shot helper for callers that only need a single next code.
 */
export function nextSequentialCode(existingCodes: ReadonlyArray<string>): string {
  return new SequentialCodeGenerator(existingCodes).next();
}
