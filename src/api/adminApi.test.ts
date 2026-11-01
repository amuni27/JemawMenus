// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { ADMIN_TOKEN_KEY, adminClient } from "./adminApi";

// AGF E4-M1 (SC5): the Super Admin console has its own client and token key. It never sends or clears the owner's
// token, and a 401 on an admin call ends only the admin session.

afterEach(() => localStorage.clear());

function adapterReturning(status: number, captured: { auth?: string }) {
    return async (config: { headers: Record<string, string> }) => {
        captured.auth = config.headers.Authorization;
        if (status >= 400) {
            const err = Object.assign(new Error("fail"), { response: { status, data: {} }, config });
            throw err;
        }
        return { data: {}, status, statusText: "OK", headers: {}, config };
    };
}

describe("admin API client", () => {
    it("sends the admin token, never the owner token", async () => {
        localStorage.setItem("token", "owner-token");
        localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
        const captured: { auth?: string } = {};
        await adminClient.get("/admin/me", { adapter: adapterReturning(200, captured) as never });
        expect(captured.auth).toBe("Bearer admin-token");
    });

    it("sends no token when only an owner is signed in", async () => {
        localStorage.setItem("token", "owner-token");
        const captured: { auth?: string } = {};
        await adminClient.get("/admin/me", { adapter: adapterReturning(200, captured) as never });
        expect(captured.auth).toBeUndefined();
    });

    it("on 401 clears only the admin token", async () => {
        localStorage.setItem("token", "owner-token");
        localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
        await expect(adminClient.get("/admin/me", { adapter: adapterReturning(401, {}) as never })).rejects.toBeTruthy();
        expect(localStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull();
        expect(localStorage.getItem("token")).toBe("owner-token");
    });
});
