// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-25 (checkpoint B): the dish detail shows an applicable special (price, struck regular price, badge, note,
// end time) and the regular price otherwise.

const get = vi.fn();
vi.mock("../../services/apiPublic.ts", () => ({ default: { get } }));

const { default: MenuItemDetail } = await import("./MenuItemDetail.tsx");

afterEach(() => cleanup());

function renderDetail(item: Record<string, unknown>) {
    get.mockResolvedValue({ data: { id: "i1", name: "Doro Wat", price: 420, currency: "ETB", ingredients: ["chicken"], status: "AVAILABLE", ...item } });
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu/item/i1"]}>
                <Routes>
                    <Route path="/:tenantSlug/menu" element={<Outlet context={{ addToWaiterList: vi.fn() }} />}>
                        <Route path="item/:itemId" element={<MenuItemDetail />} />
                    </Route>
                </Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

describe("dish detail special", () => {
    it("shows the special", async () => {
        renderDetail({ specialPrice: 350, specialNote: "Happy hour", specialUntil: "18:00", specialEndsAt: new Date(Date.now() + 3_600_000).toISOString() });
        expect((await screen.findAllByText("ETB 350.00")).length).toBeGreaterThan(0); // phone and desktop layouts
        expect(screen.getAllByText("ETB 420.00")[0].closest("s")).toBeTruthy();
        expect(screen.getByText("Special")).toBeTruthy();
        expect(screen.getByText("Happy hour")).toBeTruthy();
        expect(screen.getByText("until 18:00")).toBeTruthy();
    });

    it("shows the regular price without a special", async () => {
        renderDetail({});
        expect((await screen.findAllByText("ETB 420.00")).length).toBeGreaterThan(0);
        expect(screen.getAllByText("ETB 420.00")[0].closest("s")).toBeNull();
        expect(screen.queryByText("Special")).toBeNull();
    });
});
