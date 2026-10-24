// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// AGF-S1-12: item status must be sent with PUT (the backend maps /items/{id}/status with PUT only).

const http = { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() };
vi.mock("../services/apiAuth.ts", () => ({ default: http }));

const { default: ItemsApi } = await import("./itemsApi.ts");
const { useItems } = await import("../hooks/useItems.ts");

const item = (status: "AVAILABLE" | "UNAVAILABLE") => ({
    id: "item-1", menuId: "menu-1", categoryId: "cat-1", name: "Doro Wat", price: 350,
    ingredients: ["chicken"], status, createdAt: "", updatedAt: "",
});

beforeEach(() => Object.values(http).forEach((fn) => fn.mockReset()));

describe("ItemsApi.updateStatus", () => {
    it("sends PUT /items/{id}/status with the new status", async () => {
        http.put.mockResolvedValue({ data: item("UNAVAILABLE") });

        await ItemsApi.updateStatus("item-1", { status: "UNAVAILABLE" });

        expect(http.put).toHaveBeenCalledWith("/items/item-1/status", { status: "UNAVAILABLE" });
        expect(http.patch).not.toHaveBeenCalled();
    });
});

describe("useItems.toggleStatus (Hide / Show button)", () => {
    it("Hide: AVAILABLE item becomes UNAVAILABLE via PUT", async () => {
        http.get.mockResolvedValue({ data: [item("AVAILABLE")] });
        http.put.mockResolvedValue({ data: item("UNAVAILABLE") });
        const { result } = renderHook(() => useItems("menu-1"));
        await waitFor(() => expect(result.current.items).toHaveLength(1));

        await act(() => result.current.toggleStatus("item-1"));

        expect(http.put).toHaveBeenCalledWith("/items/item-1/status", { status: "UNAVAILABLE" });
        expect(result.current.items[0].status).toBe("UNAVAILABLE");
    });

    it("Show: UNAVAILABLE item becomes AVAILABLE via PUT", async () => {
        http.get.mockResolvedValue({ data: [item("UNAVAILABLE")] });
        http.put.mockResolvedValue({ data: item("AVAILABLE") });
        const { result } = renderHook(() => useItems("menu-1"));
        await waitFor(() => expect(result.current.items).toHaveLength(1));

        await act(() => result.current.toggleStatus("item-1"));

        expect(http.put).toHaveBeenCalledWith("/items/item-1/status", { status: "AVAILABLE" });
        expect(result.current.items[0].status).toBe("AVAILABLE");
    });
});

describe("ItemsApi.presignImage (AGF-S1-17)", () => {
    it("sends the image content type as a query parameter", async () => {
        http.get.mockResolvedValue({ data: { upload: {} } });

        await ItemsApi.presignImage("item-1", "image/png");

        expect(http.get).toHaveBeenCalledWith("/items/item-1/image/presign?contentType=image%2Fpng");
    });
});
