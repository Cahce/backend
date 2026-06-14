import type { FastifyInstance } from "fastify";
import type { ITokenService } from "../domain/Ports.js";
import type { UserRole } from "../../../shared/auth/Types.js";
import { randomUUID, randomBytes, createHash } from "crypto";

/**
 * Fastify JWT implementation of the token service.
 *
 * - Access token: short-lived JWT (HS256) carrying `exp` derived from
 *   `config.auth.accessTtlMs`.
 * - Refresh token: opaque random string (NOT a JWT) so it is trivially
 *   revocable server-side; only its SHA-256 hash is persisted.
 */
export class JwtTokenServiceFastify implements ITokenService {
    constructor(private readonly app: FastifyInstance) {}

    async generateAccessToken(payload: {
        userId: string;
        email: string;
        role: UserRole;
    }): Promise<{ token: string; jti: string; expiresAt: Date }> {
        const jti = randomUUID();
        const ttlMs = this.app.config.auth.accessTtlMs;

        // @fastify/jwt is backed by fast-jwt, whose `expiresIn` is in MILLISECONDS.
        const token = this.app.jwt.sign(
            {
                jti,
                sub: payload.userId,
                email: payload.email,
                role: payload.role,
            },
            { expiresIn: ttlMs },
        );

        const expiresAt = new Date(Date.now() + ttlMs);
        return { token, jti, expiresAt };
    }

    generateRefreshToken(): { token: string; expiresAt: Date } {
        const token = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + this.app.config.auth.refreshTtlMs);
        return { token, expiresAt };
    }

    hashRefreshToken(token: string): string {
        return createHash("sha256").update(token).digest("hex");
    }
}
