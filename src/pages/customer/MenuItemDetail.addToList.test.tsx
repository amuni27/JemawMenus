// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-04: the item-detail "Add to list" button adds to the same session waiter list as the menu cards.

const ITEMS = {
    i1: { id: "i1", name: "Doro Wat", price: 420, status: "AVAILABLE", ingredients: ["chicken"], currency: "USD" },
    i2: { id: "i2", name: "Beyaynetu", price: 320, status: "OUT_OF_STOCK", ingredients: ["lentils"], currency: "USD" },
};
const menuData = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({ usePublicBusinessMenu: () => menuData.value }));
const get = vi.fn();
vi.mock("../../services/apiPublic.ts", () => ({ default: { get } }));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");
const { default: MenuItemDetail } = await import("./MenuItemDetail.tsx");

const STORAGE_KEY = "waiter_list:biz-1";

beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});

beforeEach(() => {
    sessionStorage.clear();
    menuData.value = {
        business: { id: "biz-1", name: "Cafe", currency: "USD" },
        menus: [{ id: "m1", name: "All Day", currency: "USD", categories: [{ id: "c1", name: "Mains", items: Object.values(ITEMS) }] }],
        loading: false,
        error: "",
    };
    get.mockImplementation((url: string) => Promise.resolve({ data: ITEMS[url.split("/").pop() as keyof typeof ITEMS] }));
});
afterEach(() => cleanup());

/** Test-only control to go back to the menu, like the browser back button. */
function BackToMenu() {
    const navigate = useNavigate();
    return <button onClick={() => navigate("/biz-1/menu")}>test: back to menu</button>;
}

function renderAt(path: string) {
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={[path]}>
                <BackToMenu />
                <Routes>
                    <Route path="/:tenantSlug/menu" element={<CustomerMenu />}>
                        <Route path="item/:itemId" element={<MenuItemDetail />} />
                    </Route>
                </Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const listCount = () => screen.getByRole("button", { name: "View order" }).textContent?.replace(/\D/g, "") || "0";
const stored = () => JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");

describe("item detail Add to list", () => {
    it("adds the item to the waiter list, updates the count and confirms", async () => {
        renderAt("/biz-1/menu/item/i1");
        const button = await screen.findByRole("button", { name: "Add to list" });
        expect(listCount()).toBe("0");

        fireEvent.click(button);

        expect(await screen.findByText("Added: Doro Wat")).toBeTruthy();
        expect(listCount()).toBe("1");
        await waitFor(() => expect(stored().i1).toMatchObject({ itemId: "i1", quantity: 1, snapshot: { name: "Doro Wat", price: 420, currency: "USD" } }));
        expect(screen.getByRole("button", { name: "Add to list" })).toBeTruthy(); // stays on the detail page

        fireEvent.click(screen.getByRole("button", { name: "Add to list" }));
        await waitFor(() => expect(listCount()).toBe("2"));
        expect(stored().i1.quantity).toBe(2);
    });

    it("keeps the item when returning to the menu (same session)", async () => {
        renderAt("/biz-1/menu/item/i1");
        fireEvent.click(await screen.findByRole("button", { name: "Add to list" }));
        await waitFor(() => expect(listCount()).toBe("1"));

        fireEvent.click(screen.getByRole("button", { name: "test: back to menu" }));
        expect(await screen.findByRole("heading", { name: "Doro Wat" })).toBeTruthy(); // menu cards again
        expect(listCount()).toBe("1");

        // a fresh page load in the same session reads the stored list
        cleanup();
        renderAt("/biz-1/menu");
        expect(listCount()).toBe("1");
    });

    it("keeps sold-out items non-addable", async () => {
        renderAt("/biz-1/menu/item/i2");
        const button = (await screen.findByRole("button", { name: "Add to list" })) as HTMLButtonElement;

        expect(button.disabled).toBe(true);
        fireEvent.click(button);

        expect(listCount()).toBe("0");
        expect(stored().i2).toBeUndefined();
    });
});
