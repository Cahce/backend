import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { RefreshTokenUseCase } from "../RefreshTokenUseCase.js";
import type {
    IRefreshTokenRepository,
    ITokenService,
    IUserRepository,
    RefreshTokenRow,
    AuthUser,
} from "../../domain/Ports.js";

const ACTIVE_USER: AuthUser = {
    id: "user-1",
    email: "teacher@tlu.edu.vn",
    role: "teacher",
    passwordHash: "hash",
    isActive: true,
    mustChangePassword: false,
};

function makeTokenService(): ITokenService {
    return {
        hashRefreshToken: (t: string) => `h:${t}`,
        generateAccessToken: async () => ({
            token: "new-access",
            jti: "jti-new",
            expiresAt: new Date(Date.now() + 15 * 60_000),
        }),
        generateRefreshToken: () => ({
            token: "new-refresh",
            expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        }),
    };
}

function makeUserRepo(user: AuthUser | null): IUserRepository {
    return {
        findByEmail: async () => null,
        findById: async () => user,
        updatePassword: async () => {},
    };
}

function makeRefreshRepo(row: RefreshTokenRow | null) {
    // Mock fns carry their real signatures so `.mock.calls[i].arguments` is a
    // correctly-typed tuple (tsc needs this to index arguments[0]/[1]).
    return {
        persist: mock.fn(
            async (_p: { tokenHash: string; userId: string; familyId: string; expiresAt: Date }) => ({
                id: "rt-new",
            }),
        ),
        findByHash: mock.fn(async (_hash: string): Promise<RefreshTokenRow | null> => row),
        rotate: mock.fn(
            async (
                _oldId: string,
                _next: { tokenHash: string; familyId: string; expiresAt: Date; userId: string },
            ) => {},
        ),
        revokeFamily: mock.fn(async (_familyId: string) => {}),
        revokeByHash: mock.fn(async (_hash: string) => {}),
        deleteExpired: mock.fn(async (_now: Date) => 0),
    };
}

function activeRow(overrides: Partial<RefreshTokenRow> = {}): RefreshTokenRow {
    return {
        id: "rt-1",
        userId: "user-1",
        familyId: "fam-1",
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        ...overrides,
    };
}

describe("RefreshTokenUseCase", () => {
    it("rotates a valid token → returns new pair + user", async () => {
        const repo = makeRefreshRepo(activeRow());
        const useCase = new RefreshTokenUseCase(
            makeUserRepo(ACTIVE_USER),
            makeTokenService(),
            repo as unknown as IRefreshTokenRepository,
        );

        const result = await useCase.execute({ refreshToken: "old-refresh" });

        assert.strictEqual(result.success, true);
        if (result.success) {
            assert.strictEqual(result.accessToken, "new-access");
            assert.strictEqual(result.refreshToken, "new-refresh");
            assert.strictEqual(result.user.id, "user-1");
            assert.ok(result.user.permissions.length >= 0);
        }
        // rotate(oldId, next) called with the old row id + hashed new token, same family
        const rotateCalls = repo.rotate.mock.calls;
        assert.strictEqual(rotateCalls.length, 1);
        assert.strictEqual(rotateCalls[0].arguments[0], "rt-1");
        assert.strictEqual(rotateCalls[0].arguments[1].tokenHash, "h:new-refresh");
        assert.strictEqual(rotateCalls[0].arguments[1].familyId, "fam-1");
        assert.strictEqual(repo.revokeFamily.mock.calls.length, 0);
    });

    it("unknown token → REFRESH_TOKEN_INVALID (no rotation)", async () => {
        const repo = makeRefreshRepo(null);
        const useCase = new RefreshTokenUseCase(
            makeUserRepo(ACTIVE_USER),
            makeTokenService(),
            repo as unknown as IRefreshTokenRepository,
        );

        const result = await useCase.execute({ refreshToken: "nope" });

        assert.strictEqual(result.success, false);
        if (!result.success) assert.strictEqual(result.error.code, "REFRESH_TOKEN_INVALID");
        assert.strictEqual(repo.rotate.mock.calls.length, 0);
    });

    it("reuse of a revoked token → burns family + TOKEN_REUSE_DETECTED", async () => {
        const repo = makeRefreshRepo(activeRow({ revokedAt: new Date(Date.now() - 1000) }));
        const useCase = new RefreshTokenUseCase(
            makeUserRepo(ACTIVE_USER),
            makeTokenService(),
            repo as unknown as IRefreshTokenRepository,
        );

        const result = await useCase.execute({ refreshToken: "rotated-already" });

        assert.strictEqual(result.success, false);
        if (!result.success) assert.strictEqual(result.error.code, "TOKEN_REUSE_DETECTED");
        assert.strictEqual(repo.revokeFamily.mock.calls.length, 1);
        assert.strictEqual(repo.revokeFamily.mock.calls[0].arguments[0], "fam-1");
        assert.strictEqual(repo.rotate.mock.calls.length, 0);
    });

    it("expired token → REFRESH_TOKEN_EXPIRED", async () => {
        const repo = makeRefreshRepo(activeRow({ expiresAt: new Date(Date.now() - 1000) }));
        const useCase = new RefreshTokenUseCase(
            makeUserRepo(ACTIVE_USER),
            makeTokenService(),
            repo as unknown as IRefreshTokenRepository,
        );

        const result = await useCase.execute({ refreshToken: "stale" });

        assert.strictEqual(result.success, false);
        if (!result.success) assert.strictEqual(result.error.code, "REFRESH_TOKEN_EXPIRED");
        assert.strictEqual(repo.rotate.mock.calls.length, 0);
    });

    it("inactive/missing user → burns family + REFRESH_TOKEN_INVALID", async () => {
        const repo = makeRefreshRepo(activeRow());
        const useCase = new RefreshTokenUseCase(
            makeUserRepo({ ...ACTIVE_USER, isActive: false }),
            makeTokenService(),
            repo as unknown as IRefreshTokenRepository,
        );

        const result = await useCase.execute({ refreshToken: "ok-but-user-disabled" });

        assert.strictEqual(result.success, false);
        if (!result.success) assert.strictEqual(result.error.code, "REFRESH_TOKEN_INVALID");
        assert.strictEqual(repo.revokeFamily.mock.calls.length, 1);
        assert.strictEqual(repo.rotate.mock.calls.length, 0);
    });
});
