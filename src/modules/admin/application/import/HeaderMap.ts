
export type HeaderMap = Record<string, string>;

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

export function slugFromEmailLocal(email: string): string {
  const at = email.indexOf("@");
  const local = at === -1 ? email : email.slice(0, at);
  return local.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

const CODE_PATTERN = /^([A-Za-z]+)(\d+)$/;

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

export function nextSequentialCode(existingCodes: ReadonlyArray<string>): string {
  return new SequentialCodeGenerator(existingCodes).next();
}
