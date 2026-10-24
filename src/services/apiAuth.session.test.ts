// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

// AGF-S1-11: the axios interceptor ends the stored session on 401 / ACCOUNT_INACTIVE and reports
// other 403s, but never navigates by itself (route guards decide, so guest pages are never redirected).

const { default: apiAuth } = await import("./apiAuth.ts");
const { SESSION_ENDED_EVENT, ACCESS_DENIED_EVENT } = await import("./session.ts");

function respondWith(status: number, data: unknown = {}) {
    apiAuth.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const response = { status, statusText: "", data, headers: {}, config };
        if (status >= 400) throw new AxiosError("failed", String(status), config, null, response as never);
        return response;
    };
}

describe("apiAuth session handling", () => {
    const events: { type: string; detail: unknown }[] = [];
    const record = (e: Event) => events.push({ type: e.type, detail: (e as CustomEvent).detail });

    beforeEach(() => {
        events.length = 0;
        localStorage.setItem("token", "stored-token");
        localStorage.setItem("session", JSON.stringify({ token: "stored-token", user: { id: "u1" } }));
        window.addEventListener(SESSION_ENDED_EVENT, record);
        window.addEventListener(ACCESS_DENIED_EVENT, record);
    });

    afterEach(() => {
        window.removeEventListener(SESSION_ENDED_EVENT, record);
        window.removeEventListener(ACCESS_DENIED_EVENT, record);
        localStorage.clear();
    });

    it("attaches the stored token", async () => {
        let sent: string | undefined;
        apiAuth.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
            sent = AxiosHeaders.from(config.headers).get("Authorization") as string;
            return { status: 200, statusText: "", data: [], headers: {}, config };
        };
        await apiAuth.get("/menus");
        expect(sent).toBe("Bearer stored-token");
    });

    it("401 clears the stored session and reports it as expired", async () => {
        respondWith(401, { status: 401, code: "AUTH_REQUIRED", message: "Authentication required" });

        await expect(apiAuth.get("/menus")).rejects.toBeInstanceOf(AxiosError);

        expect(localStorage.getItem("token")).toBeNull();
        expect(localStorage.getItem("session")).toBeNull();
        expect(events).toEqual([{ type: SESSION_ENDED_EVENT, detail: { reason: "expired" } }]);
    });

    it("403 ACCOUNT_INACTIVE clears the stored session and reports it as inactive", async () => {
        respondWith(403, { status: 403, code: "ACCOUNT_INACTIVE", message: "Account is not active. Contact support." });

        await expect(apiAuth.get("/menus")).rejects.toBeInstanceOf(AxiosError);

        expect(localStorage.getItem("token")).toBeNull();
        expect(events).toEqual([{ type: SESSION_ENDED_EVENT, detail: { reason: "inactive" } }]);
    });

    it("other 403s keep the session and report access denied", async () => {
        respondWith(403, { status: 403, error: "Forbidden", message: "Not allowed" });

        await expect(apiAuth.get("/business/other/hours")).rejects.toBeInstanceOf(AxiosError);

        expect(localStorage.getItem("token")).toBe("stored-token");
        expect(events).toEqual([{ type: ACCESS_DENIED_EVENT, detail: { message: "You don't have access to this resource" } }]);
    });

    it("login and register failures are left to the form (no session events)", async () => {
        respondWith(403, { status: 403, code: "ACCOUNT_INACTIVE", message: "Account is not active. Contact support." });
        await expect(apiAuth.post("/auth/login", {})).rejects.toBeInstanceOf(AxiosError);
        respondWith(401, {});
        await expect(apiAuth.post("/auth/register", {})).rejects.toBeInstanceOf(AxiosError);

        expect(events).toEqual([]);
    });

    it("other errors pass through untouched", async () => {
        respondWith(500, { status: 500, message: "An unexpected error occurred" });
        await expect(apiAuth.get("/menus")).rejects.toBeInstanceOf(AxiosError);

        expect(localStorage.getItem("token")).toBe("stored-token");
        expect(events).toEqual([]);
    });
});
