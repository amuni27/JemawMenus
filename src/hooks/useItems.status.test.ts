// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ItemStatus } from "../types/menu";

// AGF-S1-12 (owner side): status transitions sent with PUT /items/{id}/status.

const http = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
vi.mock("../services/apiAuth.ts", () => ({ default: http }));

const { useItems } = await import("./useItems.ts");

const item = (status: ItemStatus) => ({
    id: "item-1", menuId: "menu-1", categoryId: "cat-1", name: "Tibs", price: 420,
    ingredients: ["beef"], status, createdAt: "", updatedAt: "",
});

async function hookWith(status: ItemStatus) {
    http.get.mockResolvedValue({ data: [item(status)] });
    http.put.mockImplementation((_url: string, body: { status: ItemStatus }) => Promise.resolve({ data: item(body.status) }));
    http.put.mockClear();
    const view = renderHook(() => useItems("menu-1"));
    await waitFor(() => expect(view.result.current.items).toHaveLength(1));
    return view.result;
}

describe("useItems status transitions", () => {
    it("Mark sold out: AVAILABLE -> OUT_OF_STOCK", async () => {
        const result = await hookWith("AVAILABLE");
        await act(() => result.current.toggleSoldOut("item-1"));
        expect(http.put).toHaveBeenCalledWith("/items/item-1/status", { status: "OUT_OF_STOCK" });
        expect(result.current.items[0].status).toBe("OUT_OF_STOCK");
    });

    it("Back in stock: OUT_OF_STOCK -> AVAILABLE", async () => {
        const result = await hookWith("OUT_OF_STOCK");
        await act(() => result.current.toggleSoldOut("item-1"));
        expect(http.put).toHaveBeenCalledWith("/items/item-1/status", { status: "AVAILABLE" });
        expect(result.current.items[0].status).toBe("AVAILABLE");
    });

    it("Hide on a sold-out item: OUT_OF_STOCK -> UNAVAILABLE", async () => {
        const result = await hookWith("OUT_OF_STOCK");
        await act(() => result.current.toggleStatus("item-1"));
        expect(http.put).toHaveBeenCalledWith("/items/item-1/status", { status: "UNAVAILABLE" });
    });

    it("Show on a hidden item: UNAVAILABLE -> AVAILABLE", async () => {
        const result = await hookWith("UNAVAILABLE");
        await act(() => result.current.toggleStatus("item-1"));
        expect(http.put).toHaveBeenCalledWith("/items/item-1/status", { status: "AVAILABLE" });
    });

    it("sold-out toggle does nothing for a hidden (UNAVAILABLE) item", async () => {
        const result = await hookWith("UNAVAILABLE");
        await act(() => result.current.toggleSoldOut("item-1"));
        expect(http.put).not.toHaveBeenCalled();
    });
});
