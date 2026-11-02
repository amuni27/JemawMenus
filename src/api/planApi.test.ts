// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// AGF E4-M4: the owner's plan API goes through the owner client (owner token); the restaurant comes from the token.

const get = vi.fn().mockResolvedValue({ data: {} });
const post = vi.fn().mockResolvedValue({ data: {} });
const patch = vi.fn().mockResolvedValue({ data: {} });
vi.mock("../services/apiAuth.ts", () => ({ default: { get, post, patch } }));

const { default: planApi } = await import("./planApi.ts");

describe("owner plan API", () => {
    it("reads the plan view, requests a plan and withdraws the pending request", async () => {
        await planApi.get();
        await planApi.request("MODEL_4", 3);
        await planApi.withdraw(2);
        expect(get).toHaveBeenCalledWith("/plan");
        expect(post).toHaveBeenCalledWith("/plan/requests", { planCode: "MODEL_4", expectedConfigVersion: 3 });
        expect(patch).toHaveBeenCalledWith("/plan/requests/current", { status: "WITHDRAWN", rowVersion: 2 });
    });
});
