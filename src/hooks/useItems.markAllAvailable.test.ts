// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ItemStatus } from "../types/menu";

// AGF-S2-19: one bulk request, then the authoritative list is reloaded (also after a failure).

const http = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
vi.mock("../services/apiAuth.ts", () => ({ default: http }));

const { useItems } = await import("./useItems.ts");

const item = (id: string, status: ItemStatus) => ({
    id, menuId: "menu-1", categoryId: "cat-1", name: id, price: 100, ingredients: ["x"], status, createdAt: "", updatedAt: "",
});
const before = [item("a", "OUT_OF_STOCK"), item("b", "OUT_OF_STOCK"), item("c", "AVAILABLE"), item("d", "UNAVAILABLE")];
const after = [item("a", "AVAILABLE"), item("b", "AVAILABLE"), item("c", "AVAILABLE"), item("d", "UNAVAILABLE")];

async function loaded() {
    [http.get, http.post].forEach((m) => m.mockReset());
    http.get.mockResolvedValueOnce({ data: before });
    const view = renderHook(() => useItems("menu-1"));
    await waitFor(() => expect(view.result.current.items).toHaveLength(4));
    return view.result;
}

describe("useItems.markAllAvailable", () => {
    it("sends one bulk request for the menu, returns the server's count and reloads the list", async () => {
        const result = await loaded();
        http.post.mockResolvedValue({ data: { updated: 2 } });
        http.get.mockResolvedValueOnce({ data: after });

        let updated = -1;
        await act(async () => { updated = await result.current.markAllAvailable(); });

        expect(http.post).toHaveBeenCalledTimes(1);
        expect(http.post).toHaveBeenCalledWith("/menus/menu-1/items/mark-all-available", {});
        expect(http.put).not.toHaveBeenCalled();
        expect(updated).toBe(2);
        expect(http.get).toHaveBeenLastCalledWith("/menus/menu-1/items");
        expect(result.current.items.map((i) => i.status)).toEqual(["AVAILABLE", "AVAILABLE", "AVAILABLE", "UNAVAILABLE"]);
    });

    it("reloads the authoritative list and rethrows when the request fails", async () => {
        const result = await loaded();
        http.post.mockRejectedValue({ response: { status: 500, data: { message: "Server error" } } });
        http.get.mockResolvedValueOnce({ data: before });

        await act(async () => {
            await expect(result.current.markAllAvailable()).rejects.toBeTruthy();
        });
        expect(http.get).toHaveBeenCalledTimes(2); // initial load + reload after the failure
        expect(result.current.items.map((i) => i.status)).toEqual(before.map((i) => i.status));
    });
});
