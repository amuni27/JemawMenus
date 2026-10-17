// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF-S1-05: the guest item page must use the tenant-scoped public endpoint.

const get = vi.fn();
vi.mock("../../services/apiPublic.ts", () => ({ default: { get } }));

const { default: MenuItemDetail } = await import("./MenuItemDetail.tsx");

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/:tenantSlug/menu/item/:itemId" element={<MenuItemDetail />} />
            </Routes>
        </MemoryRouter>
    );

// No beforeEach reset: each test sets its own response. (A beforeEach mockReset/mockClear made Vitest
// report the lazily rejected promise of the 404 test as unhandled, although the page handles it.)
afterEach(cleanup);

describe("MenuItemDetail", () => {
    it("loads the item from /venue/{businessId}/items/{itemId}", async () => {
        get.mockResolvedValue({ data: { id: "item-1", name: "Doro Wat", price: 350, ingredients: ["chicken"], status: "AVAILABLE" } });

        renderAt("/biz-1/menu/item/item-1");

        expect(await screen.findByText("Doro Wat")).toBeTruthy();
        expect(get).toHaveBeenLastCalledWith("/venue/biz-1/items/item-1");
        expect(get).not.toHaveBeenCalledWith("/venue/items/item-1");
    });

    it("shows 'Item not found' when the API returns 404 (hidden or unknown item)", async () => {
        get.mockImplementation(() =>
            Promise.reject(Object.assign(new Error("Request failed with status code 404"), { response: { status: 404 } })));

        renderAt("/biz-1/menu/item/hidden-item");

        expect(await screen.findByText("Item not found.")).toBeTruthy();
        expect(get).toHaveBeenLastCalledWith("/venue/biz-1/items/hidden-item");
    });
});
