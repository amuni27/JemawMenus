// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-33: an unknown menu (API 404) shows the owner not-found screen on the detail, edit and preview pages;
// other failures keep the existing error with Retry.

const getMenu = vi.fn();
const previewMenu = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { getMenu, previewMenu, updateMenu: vi.fn(), listMenuTypes: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1" } }) }));
vi.mock("../../hooks/useMenus", () => ({ useMenus: () => ({ deleteMenu: vi.fn() }) }));
vi.mock("../../hooks/useCategories", () => ({ useCategories: () => ({ categories: [], loading: false }) }));
vi.mock("../../hooks/useItems.ts", () => ({ useItems: () => ({ items: [] }) }));
vi.mock("../../components/menu/CategoryPanel.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/ItemsPanel.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/CategoryModal.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/ItemModal.tsx", () => ({ default: () => null }));
vi.mock("./MenuWizard", () => ({ default: () => <p>Menu wizard</p> }));

const { default: MenuDetailPage } = await import("./MenuDetailPage.tsx");
const { default: MenuEditPage } = await import("./MenuEditPage.tsx");
const { default: MenuPreviewPage } = await import("./MenuPreviewPage.tsx");

const notFound = { response: { status: 404, data: { status: 404, message: "Menu not found" } } };
const serverError = { response: { status: 500, data: { status: 500, message: "Something went wrong on our side" } } };

beforeEach(() => [getMenu, previewMenu].forEach((m) => m.mockReset()));
afterEach(() => cleanup());

function renderAt(path: string) {
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/:tenantSlug/admin/menus/:menuId" element={<MenuDetailPage />} />
                    <Route path="/:tenantSlug/admin/menus/:menuId/edit" element={<MenuEditPage />} />
                    <Route path="/:tenantSlug/admin/menus/:menuId/preview" element={<MenuPreviewPage />} />
                </Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const ownerNotFound = async () => {
    expect(await screen.findByRole("heading", { level: 2, name: "We can't find that page" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to your dashboard" }).getAttribute("href")).toBe("/biz-1/admin");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
};

describe("owner pages: unknown menu", () => {
    it.each([["detail", ""], ["edit", "/edit"]])("menu %s page shows the owner not-found screen on 404", async (_, suffix) => {
        getMenu.mockRejectedValue(notFound);
        renderAt(`/biz-1/admin/menus/nope${suffix}`);
        await ownerNotFound();
    });

    it("preview page shows the owner not-found screen on 404", async () => {
        previewMenu.mockRejectedValue(notFound);
        renderAt("/biz-1/admin/menus/nope/preview");
        // the preview page has no admin layout, so the screen is a full page with its own h1
        expect(await screen.findByRole("heading", { level: 1, name: "We can't find that page" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Go to your dashboard" }).getAttribute("href")).toBe("/biz-1/admin");
    });

    it("keeps the error with Retry for server failures (not a 404)", async () => {
        getMenu.mockRejectedValue(serverError);
        renderAt("/biz-1/admin/menus/m1");
        expect(await screen.findByRole("button", { name: "Retry" })).toBeTruthy();
        expect(screen.getByText("Something went wrong on our side")).toBeTruthy();
        expect(screen.queryByRole("heading", { name: "We can't find that page" })).toBeNull();
    });
});
