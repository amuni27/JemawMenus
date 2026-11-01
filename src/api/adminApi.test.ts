// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { ADMIN_TOKEN_KEY, adminApi, adminClient } from "./adminApi";

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

    it("reads, saves and pages the monetization configuration under /admin (AGF E4-M2)", async () => {
        localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
        const calls: { method?: string; url?: string; data?: unknown; params?: unknown }[] = [];
        const original = adminClient.defaults.adapter;
        adminClient.defaults.adapter = (async (config: { method?: string; url?: string; data?: unknown; params?: unknown }) => {
            calls.push({ method: config.method, url: config.url, data: config.data, params: config.params });
            return { data: {}, status: 200, statusText: "OK", headers: {}, config };
        }) as never;
        try {
            await adminApi.monetizationConfig();
            await adminApi.saveMonetizationConfig({ setting: "SETTING_2", models: ["MODEL_2"], expectedVersion: 3 });
            await adminApi.monetizationHistory(1, 10);
        } finally {
            adminClient.defaults.adapter = original;
        }
        expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
            "get /admin/monetization-config", "put /admin/monetization-config", "get /admin/monetization-config/history"]);
        expect(JSON.parse(calls[1].data as string)).toEqual({ setting: "SETTING_2", models: ["MODEL_2"], expectedVersion: 3 });
        expect(calls[2].params).toEqual({ page: 1, size: 10 });
    });

    it("calls the plan, restaurant and subscription APIs under /admin (AGF E4-M3)", async () => {
        localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
        const calls: { method?: string; url?: string; data?: unknown; params?: unknown }[] = [];
        const original = adminClient.defaults.adapter;
        adminClient.defaults.adapter = (async (config: { method?: string; url?: string; data?: unknown; params?: unknown }) => {
            calls.push({ method: config.method, url: config.url, data: config.data, params: config.params });
            return { data: {}, status: 200, statusText: "OK", headers: {}, config };
        }) as never;
        try {
            await adminApi.plans();
            await adminApi.businesses("cafe", 0, 20);
            await adminApi.businessSubscription("b1");
            await adminApi.subscriptionHistory("b1");
            await adminApi.recordSubscription("b1", { planCode: "MODEL_4", expectedConfigVersion: 2 });
            await adminApi.endSubscription("b1", 3);
        } finally {
            adminClient.defaults.adapter = original;
        }
        expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
            "get /admin/plans", "get /admin/businesses", "get /admin/businesses/b1/subscription", "get /admin/businesses/b1/subscriptions",
            "post /admin/businesses/b1/subscription", "patch /admin/businesses/b1/subscription"]);
        expect(calls[1].params).toEqual({ query: "cafe", page: 0, size: 20 });
        expect(JSON.parse(calls[4].data as string)).toEqual({ planCode: "MODEL_4", expectedConfigVersion: 2 });
        expect(JSON.parse(calls[5].data as string)).toEqual({ status: "EXPIRED", rowVersion: 3 });
    });
});

