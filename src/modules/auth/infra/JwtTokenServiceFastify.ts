import type { FastifyInstance } from "fastify";
import type { ITokenService } from "../domain/Ports.js";
import type { UserRole } from "../../../shared/auth/Types.js";
import { randomUUID } from "crypto";

/**
 * Fastify JWT implementation of token service
 */
export class JwtTokenServiceFastify implements ITokenService {
    constructor(private readonly app: FastifyInstance) {}

    async generate(payload: {
        userId: string;
        email: string;
        role: UserRole;
    }): Promise<string> {
        const jti = randomUUID();

        const token = this.app.jwt.sign({
            jti,
            sub: payload.userId,
            email: payload.email,
            role: payload.role,
        });

        return token;
    }
}
