import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AGF-S1-16a: request payloads (including login passwords) must never reach the browser console.

const post = vi.fn();
vi.mock("./apiAuth.ts", () => ({ default: { post, get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const { postRequest } = await import("./apiService.ts");
const { login } = await import("./authService.ts");

const SECRET_PASSWORD = "S3cret-Passw0rd!";
const consoleMethods = ["log", "info", "debug", "warn", "error"] as const;

describe("console logging of request payloads", () => {
    const spies: ReturnType<typeof vi.spyOn>[] = [];

    beforeEach(() => {
        post.mockReset();
        vi.stubGlobal("localStorage", { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() });
        consoleMethods.forEach((m) => spies.push(vi.spyOn(console, m).mockImplementation(() => {})));
    });

    afterEach(() => {
        spies.splice(0).forEach((s) => s.mockRestore());
        vi.unstubAllGlobals();
    });

    const printed = () => JSON.stringify(spies.flatMap((s) => s.mock.calls));

    it("does not print the email or password when logging in", async () => {
        post.mockResolvedValue({
            data: { token: "jwt-token", user: { id: "u1", email: "owner@example.com" } },
        });

        await login("owner@example.com", SECRET_PASSWORD);

        expect(post).toHaveBeenCalledWith("/auth/login", { email: "owner@example.com", password: SECRET_PASSWORD });
        expect(printed()).not.toContain(SECRET_PASSWORD);
        expect(printed()).not.toContain("owner@example.com");
    });

    it("does not print the body of any other POST", async () => {
        post.mockResolvedValue({ data: {} });

        await postRequest("/menus/m1/categories", { name: "Private Category Name" });

        expect(post).toHaveBeenCalledWith("/menus/m1/categories", { name: "Private Category Name" });
        spies.forEach((s) => expect(s).not.toHaveBeenCalled());
    });
});
