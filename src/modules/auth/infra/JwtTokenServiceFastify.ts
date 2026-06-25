import type { FastifyInstance } from "fastify";
import type { ITokenService } from "../domain/Ports.js";
import type { UserRole } from "../../../shared/auth/Types.js";
import { randomUUID, randomBytes, createHash } from "crypto";

/**
 * Parse an @fastify/jwt-style TTL ("15m" | "1h" | "1d" | "900s" | bare seconds)
 * to milliseconds. Used to compute `expiresAt` alongside the signed `exp`.
 */
export function parseTtlMs(ttl: string): number {
    const match = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
    if (!match) {
        const seconds = Number(ttl);
        if (Number.isFinite(seconds)) return seconds * 1000;
        throw new Error(`Invalid TTL format: "${ttl}"`);
    }
    const value = Number(match[1]);
    const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * unitMs[match[2]];
}

/**
 * Fastify JWT implementation of the token service.
 *
 * - Access token: short-lived JWT signed with `expiresIn = config.auth.accessTtl`.
 * - Refresh token: opaque random string (NOT a JWT); only its SHA-256 hash is stored.
 */
export class JwtTokenServiceFastify implements ITokenService {
    constructor(private readonly app: FastifyInstance) {}

    async generateAccessToken(payload: {
        userId: string;
        email: string;
        role: UserRole;
    }): Promise<{ token: string; jti: string; expiresAt: Date }> {
        const jti = randomUUID();
        const accessTtl = this.app.config.auth.accessTtl;

        const token = this.app.jwt.sign(
            {
                jti,
                sub: payload.userId,
                email: payload.email,
                role: payload.role,
            },
            { expiresIn: accessTtl },
        );

        return { token, jti, expiresAt: new Date(Date.now() + parseTtlMs(accessTtl)) };
    }

    generateRefreshToken(): { token: string; expiresAt: Date } {
        const token = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + parseTtlMs(this.app.config.auth.refreshTtl));
        return { token, expiresAt };
    }

    hashRefreshToken(token: string): string {
        return createHash("sha256").update(token).digest("hex");
    }
}
