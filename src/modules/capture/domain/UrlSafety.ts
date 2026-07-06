
import { isIP } from "node:net";

export class UnsafeUrlError extends Error {
  constructor(
    message: string = "URL không được phép (chỉ chấp nhận liên kết http/https công khai)"
  ) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

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

  if (url.username || url.password) {
    throw new UnsafeUrlError("URL không được chứa thông tin đăng nhập");
  }

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
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      !host.includes(".")
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
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (addr === "::1" || addr === "::") return true;
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  if (/^f[cd]/.test(addr)) return true;
  if (/^fe[89ab]/.test(addr)) return true;
  return false;
}
