// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// AGF-S2-33: the guest menu hook tells "not found" (404) apart from other failures, uses readable messages,
// and can retry.

const listMenuTypes = vi.fn();
vi.mock("../api/publicMenueApi.ts", () => ({ default: { listMenuTypes } }));

const { usePublicBusinessMenu } = await import("./usePublicBusinessMenu.ts");

describe("usePublicBusinessMenu errors", () => {
    it("flags a 404 as notFound", async () => {
        listMenuTypes.mockRejectedValueOnce({ response: { status: 404, data: { message: "Business not found" } } });
        const { result } = renderHook(() => usePublicBusinessMenu("nope"));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.notFound).toBe(true);
    });

    it("uses a readable message for network failures, not 'Network Error', and retries", async () => {
        listMenuTypes.mockRejectedValueOnce(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }))
            .mockResolvedValueOnce({ data: { business: { id: "b1", name: "Cafe" }, menus: [] } });
        const { result } = renderHook(() => usePublicBusinessMenu("b1"));
        await waitFor(() => expect(result.current.error).toBe("Could not reach the server. Check your connection and try again."));
        expect(result.current.notFound).toBe(false);
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.business?.name).toBe("Cafe"));
        expect(result.current.error).toBe("");
    });
});
