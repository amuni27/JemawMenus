// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-17: the owner sees one of their menus exactly as guests would once it's published, from the owner-only
// preview endpoint. The public API is never called; ordering is off; item detail comes from the preview data.

const previewMenu = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { previewMenu } }));
const listMenuTypes = vi.fn();
const findItem = vi.fn();
vi.mock("../../api/publicMenueApi.ts", () => ({ default: { listMenuTypes, findItem } }));

const { default: MenuPreviewPage } = await import("./MenuPreviewPage.tsx");
const { default: MenuItemDetail } = await import("../customer/MenuItemDetail.tsx");

const item = (id: string, name: string, extra: Record<string, unknown> = {}) =>
    ({ id, name, price: 120, status: "AVAILABLE", currency: "ETB", ...extra });

const preview = (menu: Record<string, unknown>) => ({
    data: {
        business: { id: "biz-1", name: "Abol Cafe", currency: "ETB", open24_7: true, hours: [] },
        menus: [{ id: "m1", name: "Dinner", currency: "ETB", active: false, visibility: "PUBLIC", categories: [
            { id: "c1", menuId: "m1", name: "Mains", sortOrder: 0, items: [
                item("a1", "Doro Wat", { description: "Chicken stew", featured: true }),
                item("a2", "Tibs", { status: "OUT_OF_STOCK" }),
                item("u1", "Secret Special", { status: "UNAVAILABLE" }), // defensive: never shown
            ] },
        ], ...menu }],
    },
});

beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});

beforeEach(() => [previewMenu, listMenuTypes, findItem].forEach((m) => m.mockReset()));
afterEach(() => {
    cleanup();
    sessionStorage.clear();
});

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

function renderPreview(path = "/biz-1/admin/menus/m1/preview") {
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/:tenantSlug/admin/menus/:menuId/preview" element={<MenuPreviewPage />}>
                        <Route path="item/:itemId" element={<MenuItemDetail />} />
                    </Route>
                </Routes>
                <Where />
            </MemoryRouter>
        </ToastProvider>
    );
}

const banner = () => screen.getByRole("region", { name: "Preview" });

describe("owner menu preview", () => {
    it("loads the owner preview, never the public menu, and shows the guest presentation", async () => {
        previewMenu.mockResolvedValue(preview({}));
        renderPreview();
        expect(await screen.findByRole("region", { name: "Chef's picks" })).toBeTruthy();
        expect(previewMenu).toHaveBeenCalledWith("m1");
        expect(listMenuTypes).not.toHaveBeenCalled();
        expect(screen.getAllByText("Abol Cafe").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Doro Wat").length).toBe(2); // Chef's picks and its category
    });

    it("says it's a preview and shows the menu's status", async () => {
        previewMenu.mockResolvedValue(preview({}));
        renderPreview();
        await screen.findByRole("region", { name: "Chef's picks" });
        expect(within(banner()).getByText("Preview — not visible to guests")).toBeTruthy();
        expect(within(banner()).getByText("Unpublished")).toBeTruthy();
        expect(within(banner()).getByRole("link", { name: "Back to menu" }).getAttribute("href")).toBe("/biz-1/admin/menus/m1");
    });

    it("labels a private menu Private", async () => {
        previewMenu.mockResolvedValue(preview({ active: true, visibility: "PRIVATE" }));
        renderPreview();
        await screen.findByRole("region", { name: "Chef's picks" });
        expect(within(banner()).getByText("Private")).toBeTruthy();
    });

    it("tells the owner a live menu is visible to guests", async () => {
        previewMenu.mockResolvedValue(preview({ active: true, visibility: "PUBLIC" }));
        renderPreview();
        await screen.findByRole("region", { name: "Chef's picks" });
        expect(within(banner()).getByText("Live")).toBeTruthy();
        expect(within(banner()).getByText("Guests can see this menu")).toBeTruthy();
        expect(within(banner()).queryByText("Preview — not visible to guests")).toBeNull();
    });

    it("shows sold-out items as Sold Out and never hidden ones", async () => {
        previewMenu.mockResolvedValue(preview({}));
        renderPreview();
        await screen.findByRole("region", { name: "Chef's picks" });
        expect(screen.getByText("Sold Out")).toBeTruthy();
        expect(screen.queryByText("Secret Special")).toBeNull();
    });

    it("turns ordering off: add buttons are disabled and nothing is added", async () => {
        previewMenu.mockResolvedValue(preview({}));
        renderPreview();
        await screen.findByRole("region", { name: "Chef's picks" });
        expect(screen.queryByRole("button", { name: /^Add / })).toBeNull();
        const buttons = screen.getAllByRole("button", { name: "Adding is off in preview" }) as HTMLButtonElement[];
        expect(buttons.length).toBe(3); // Doro Wat in Chef's picks and in Mains, Tibs in Mains
        buttons.forEach((b) => {
            expect(b.disabled).toBe(true);
            fireEvent.click(b);
        });
        expect(JSON.parse(sessionStorage.getItem("waiter_list:biz-1") ?? "{}")).toEqual({}); // no waiter-list entry
    });

    it("opens item detail from the preview data, without a public request, with ordering off", async () => {
        previewMenu.mockResolvedValue(preview({}));
        renderPreview();
        await screen.findByRole("region", { name: "Chef's picks" });
        fireEvent.click(within(screen.getByRole("region", { name: "Chef's picks" })).getByText("Doro Wat"));

        expect(screen.getByTestId("where").textContent).toBe("/biz-1/admin/menus/m1/preview/item/a1");
        expect(await screen.findByRole("heading", { level: 1, name: "Doro Wat" })).toBeTruthy();
        expect(screen.getByText("Chicken stew")).toBeTruthy();
        expect(findItem).not.toHaveBeenCalled();
        const add = screen.getByRole("button", { name: "Adding is off in preview" }) as HTMLButtonElement;
        expect(add.disabled).toBe(true);
        expect(within(banner()).getByText("Unpublished")).toBeTruthy(); // the banner stays on detail
    });

    it("explains an empty preview instead of failing", async () => {
        previewMenu.mockResolvedValue(preview({ categories: [] }));
        renderPreview();
        expect(await screen.findByText(/Guests would see "Menu coming soon"/)).toBeTruthy();
        expect(within(banner()).getByText("Unpublished")).toBeTruthy();
    });

    it("shows a load error with Retry", async () => {
        previewMenu.mockRejectedValueOnce({ response: { status: 500, data: { message: "Server error" } } }).mockResolvedValue(preview({}));
        renderPreview();
        expect(await screen.findByRole("alert")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        await waitFor(() => expect(previewMenu).toHaveBeenCalledTimes(2));
        expect(await screen.findByRole("region", { name: "Chef's picks" })).toBeTruthy();
    });
});
