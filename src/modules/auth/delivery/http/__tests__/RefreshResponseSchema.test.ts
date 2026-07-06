import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { authResponseSchemas } from "../Routes.js";


const fullUser = {
    id: "u1",
    email: "admin@tlu.edu.vn",
    role: "admin",
    permissions: ["templates:manage", "users:manage"],
    mustChangePassword: false,
};

async function serializeWith(schema: unknown): Promise<Record<string, unknown>> {
    const app = Fastify();
    app.post(
        "/probe",
        { schema: { response: { 200: schema } } },
        async () => ({
            accessToken: "access-token",
            refreshToken: "refresh-token",
            user: fullUser,
        }),
    );
    try {
        const res = await app.inject({ method: "POST", url: "/probe" });
        assert.equal(res.statusCode, 200);
        return res.json() as Record<string, unknown>;
    } finally {
        await app.close();
    }
}

function assertFullUser(body: Record<string, unknown>, label: string): void {
    const user = body.user as Record<string, unknown> | undefined;
    assert.ok(user, `${label}: user missing from serialized body`);
    assert.equal(user.id, fullUser.id, `${label}: user.id stripped`);
    assert.equal(user.email, fullUser.email, `${label}: user.email stripped`);
    assert.equal(user.role, fullUser.role, `${label}: user.role stripped`);
    assert.deepEqual(
        user.permissions,
        fullUser.permissions,
        `${label}: user.permissions stripped`,
    );
    assert.equal(
        user.mustChangePassword,
        fullUser.mustChangePassword,
        `${label}: user.mustChangePassword stripped`,
    );
}

describe("auth response schema serialization", () => {
    it("refreshResponse keeps the full user (regression: was serialized as {})", async () => {
        const body = await serializeWith(authResponseSchemas.refreshResponse);
        assert.equal(body.accessToken, "access-token");
        assert.equal(body.refreshToken, "refresh-token");
        assertFullUser(body, "refreshResponse");
    });

    it("loginResponse keeps the full user", async () => {
        const body = await serializeWith(authResponseSchemas.loginResponse);
        assertFullUser(body, "loginResponse");
    });

    it("currentUserResponse keeps the full user", async () => {
        const body = await serializeWith(authResponseSchemas.currentUserResponse);
        assertFullUser(body, "currentUserResponse");
    });
});
