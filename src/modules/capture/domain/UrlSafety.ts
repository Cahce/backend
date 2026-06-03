/**
 * SSRF guard for server-side URL fetching.
 *
 * The translation-server fetches arbitrary URLs on the user's behalf, so we
 * reject obviously-internal targets (loopback, private ranges, link-local,
 * internal hostnames) before forwarding a URL to it.
 *
 * Note: this is a synchronous literal-IP + hostname check. A determined
 * attacker can still point a public DNS name at an internal IP (DNS-rebinding);
 * the translation-server's own network isolation (run it in a locked-down
 * container/network) is the second layer of defence.
 *
 * No framework dependencies (uses the `node:net` built-in only).
 */

import { isIP } from "node:net";

export class UnsafeUrlError extends Error {
  constructor(
    message: string = "URL không được phép (chỉ chấp nhận liên kết http/https công khai)"
  ) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * Validate that `raw` is a public http(s) URL safe to fetch server-side.
 * @throws UnsafeUrlError when the URL is malformed, non-http(s), or targets an
 *   internal/private host.
 * @returns the parsed URL on success.
 */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeUrlError("URL không hợp lệ");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Chỉ chấp nhận liên kết http hoặc https");
  }

  // Embedded credentials can be used to obscure the real host.
  if (url.username || url.password) {
    throw new UnsafeUrlError("URL không được chứa thông tin đăng nhập");
  }

  // url.hostname keeps brackets for IPv6 literals (e.g. "[::1]"); strip them so
  // isIP() recognises the address.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) {
    throw new UnsafeUrlError("URL thiếu hostname");
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    if (isPrivateIpv4(host)) {
      throw new UnsafeUrlError("Không cho phép địa chỉ IP nội bộ");
    }
  } else if (ipVersion === 6) {
    if (isPrivateIpv6(host)) {
      throw new UnsafeUrlError("Không cho phép địa chỉ IP nội bộ");
    }
  } else {
    // Hostname (not an IP literal).
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      !host.includes(".") // bare internal hostnames (e.g. "router")
    ) {
      throw new UnsafeUrlError("Không cho phép hostname nội bộ");
    }
  }

  return url;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (
    parts.length !== 4 ||
    parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)
  ) {
    return true; // malformed → treat as unsafe
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (addr === "::1" || addr === "::") return true; // loopback / unspecified
  // IPv4-mapped (::ffff:127.0.0.1) → check the embedded IPv4.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  if (/^f[cd]/.test(addr)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(addr)) return true; // fe80::/10 link-local
  return false;
}
