// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S1-15 / PO-2: owner publishing and visibility controls.

const listMenuTypes = vi.fn();
const createMenu = vi.fn();
const updateMenu = vi.fn();
const getMenu = vi.fn();
const listMenus = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { listMenuTypes, createMenu, updateMenu, getMenu, listMenus } }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1" } }) }));
vi.mock("../../hooks/useMenus", () => ({ useMenus: () => ({ deleteMenu: vi.fn() }) }));
vi.mock("../../hooks/useItems.ts", () => ({ useItems: () => ({ items: [] }) }));
vi.mock("../../components/menu/ItemsPanel.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/ItemModal.tsx", () => ({ default: () => null }));

const getCategories = vi.fn();
const updateCategory = vi.fn();
vi.mock("../../api/categoriesApi.ts", () => ({
    default: { getCategories, updateCategory, createCategory: vi.fn(), deleteCategory: vi.fn() },
}));

const { default: MenuCreatePage } = await import("./MenuCreatePage.tsx");
const { default: MenuEditPage } = await import("./MenuEditPage.tsx");
const { default: MenusListPage } = await import("./MenusListPage.tsx");
const { default: MenuDetailPage } = await import("./MenuDetailPage.tsx");

const TYPES = [{ id: "t-lunch", name: "Lunch" }];

function renderAt(path: string) {
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/:tenantSlug/admin/menus" element={<MenusListPage />} />
                    <Route path="/:tenantSlug/admin/menus/new" element={<MenuCreatePage />} />
                    <Route path="/:tenantSlug/admin/menus/:menuId" element={<MenuDetailPage />} />
                    <Route path="/:tenantSlug/admin/menus/:menuId/edit" element={<MenuEditPage />} />
                </Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const nameInput = () => screen.getAllByRole("textbox")[0] as HTMLInputElement;
const typeSelect = () => screen.getByLabelText("Menu Type") as HTMLSelectElement;
const visibilitySelect = () => screen.getByLabelText("Visibility") as HTMLSelectElement;
const publishedToggle = () => screen.getByRole("checkbox", { name: /Published/ }) as HTMLInputElement;

beforeEach(() => {
    [listMenuTypes, createMenu, updateMenu, getMenu, listMenus, getCategories, updateCategory].forEach((m) => m.mockReset());
    listMenuTypes.mockResolvedValue({ data: TYPES });
    listMenus.mockResolvedValue({ status: 200, data: [] });
    getCategories.mockResolvedValue({ data: [] });
});
afterEach(() => cleanup());

describe("menu form publishing controls", () => {
    it("creates new menus unpublished by default and says so after saving", async () => {
        createMenu.mockResolvedValue({ status: 201, data: { id: "m1", active: false, visibility: "PUBLIC" } });
        renderAt("/biz-1/admin/menus/new");
        await screen.findByRole("option", { name: "Lunch" });

        expect(publishedToggle().checked).toBe(false);
        expect(visibilitySelect().value).toBe("PUBLIC");
        expect(screen.getByText(/Guests can't see this menu until you publish it/)).toBeTruthy();

        fireEvent.change(nameInput(), { target: { value: "Dinner" } });
        fireEvent.change(typeSelect(), { target: { value: "t-lunch" } });
        fireEvent.click(screen.getByRole("button", { name: "Save Menu" }));

        await waitFor(() => expect(createMenu).toHaveBeenCalled());
        expect(createMenu.mock.calls[0][0]).toMatchObject({ visibility: "PUBLIC", isActive: false });
        expect(await screen.findByText("Menu created as Unpublished — publish it when it's ready.")).toBeTruthy();
    });

    it("sends the chosen visibility and published state", async () => {
        createMenu.mockResolvedValue({ status: 201, data: { id: "m1", active: true, visibility: "PRIVATE" } });
        renderAt("/biz-1/admin/menus/new");
        await screen.findByRole("option", { name: "Lunch" });

        fireEvent.change(nameInput(), { target: { value: "Staff" } });
        fireEvent.change(typeSelect(), { target: { value: "t-lunch" } });
        fireEvent.change(visibilitySelect(), { target: { value: "PRIVATE" } });
        fireEvent.click(publishedToggle());
        expect(screen.getByText(/Only you can see this menu/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Save Menu" }));

        await waitFor(() => expect(createMenu).toHaveBeenCalled());
        expect(createMenu.mock.calls[0][0]).toMatchObject({ visibility: "PRIVATE", isActive: true });
        await waitFor(() => expect(screen.queryByText(/Menu created as Unpublished/)).toBeNull());
    });

    it("edit shows the stored state and sends changes", async () => {
        getMenu.mockResolvedValue({ data: { id: "m1", businessId: "biz-1", name: "Staff", menuTypeId: "t-lunch", visibility: "PRIVATE", active: false } });
        updateMenu.mockResolvedValue({ status: 200, data: {} });
        renderAt("/biz-1/admin/menus/m1/edit");
        await screen.findByRole("option", { name: "Lunch" });
        await waitFor(() => expect(visibilitySelect().value).toBe("PRIVATE"));
        expect(publishedToggle().checked).toBe(false);

        fireEvent.change(visibilitySelect(), { target: { value: "PUBLIC" } });
        fireEvent.click(publishedToggle());
        fireEvent.click(screen.getByRole("button", { name: "Update" }));

        await waitFor(() => expect(updateMenu).toHaveBeenCalled());
        expect(updateMenu.mock.calls[0]).toEqual(["m1", expect.objectContaining({ visibility: "PUBLIC", isActive: true })]);
    });
});

describe("menus list badges", () => {
    it("shows Live, Private and Unpublished from each menu's stored state", async () => {
        listMenus.mockResolvedValue({
            status: 200,
            data: [
                { id: "a", businessId: "biz-1", name: "Live Menu", menuTypeName: "Lunch", visibility: "PUBLIC", active: true },
                { id: "b", businessId: "biz-1", name: "Private Menu", menuTypeName: "Lunch", visibility: "PRIVATE", active: true },
                { id: "c", businessId: "biz-1", name: "Draft Menu", menuTypeName: "Lunch", visibility: "PUBLIC", active: false },
            ],
        });
        renderAt("/biz-1/admin/menus");

        const badgeFor = async (name: string) => {
            const row = (await screen.findAllByText(name))[0].closest("[data-menu-row]") as HTMLElement;
            return within(row).getByTestId("menu-status").textContent;
        };
        expect(await badgeFor("Live Menu")).toBe("Live");
        expect(await badgeFor("Private Menu")).toBe("Private");
        expect(await badgeFor("Draft Menu")).toBe("Unpublished");
    });
});

describe("menu detail publish action and category visibility", () => {
    const MENU = { id: "m1", businessId: "biz-1", name: "Dinner", menuTypeId: "t-lunch", visibility: "PUBLIC", active: false };

    it("publishes and unpublishes from the header", async () => {
        getMenu.mockResolvedValue({ data: MENU });
        updateMenu.mockResolvedValueOnce({ data: { ...MENU, active: true } }).mockResolvedValueOnce({ data: { ...MENU, active: false } });
        renderAt("/biz-1/admin/menus/m1");

        expect((await screen.findByTestId("menu-status")).textContent).toBe("Unpublished");
        fireEvent.click(screen.getByRole("button", { name: "Publish" }));

        await waitFor(() => expect(screen.getByTestId("menu-status").textContent).toBe("Live"));
        expect(updateMenu).toHaveBeenLastCalledWith("m1", { isActive: true });

        fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
        await waitFor(() => expect(screen.getByTestId("menu-status").textContent).toBe("Unpublished"));
        expect(updateMenu).toHaveBeenLastCalledWith("m1", { isActive: false });
    });

    it("hides and shows a category with the existing category update API", async () => {
        getMenu.mockResolvedValue({ data: { ...MENU, active: true } });
        getCategories.mockResolvedValue({ data: [{ id: "c1", menuId: "m1", name: "Specials", sortOrder: 0, active: true }] });
        updateCategory
            .mockResolvedValueOnce({ data: { id: "c1", menuId: "m1", name: "Specials", sortOrder: 0, active: false } })
            .mockResolvedValueOnce({ data: { id: "c1", menuId: "m1", name: "Specials", sortOrder: 0, active: true } });
        renderAt("/biz-1/admin/menus/m1");

        fireEvent.click(await screen.findByRole("button", { name: "Hide Specials from guests" }));
        await waitFor(() => expect(updateCategory).toHaveBeenLastCalledWith("c1", { isActive: false }));
        expect(await screen.findByText("Hidden")).toBeTruthy();
        expect(screen.getByText("Specials")).toBeTruthy(); // the owner still sees it

        fireEvent.click(screen.getByRole("button", { name: "Show Specials to guests" }));
        await waitFor(() => expect(updateCategory).toHaveBeenLastCalledWith("c1", { isActive: true }));
        await waitFor(() => expect(screen.queryByText("Hidden")).toBeNull());
    });
});

// AGF-S2-17: owners open a guest-style preview of the menu from its page
describe("menu detail preview link", () => {
    it("links to the owner preview of this menu", async () => {
        getMenu.mockResolvedValue({ data: { id: "m1", businessId: "biz-1", name: "Dinner", visibility: "PUBLIC", active: false } });
        renderAt("/biz-1/admin/menus/m1");
        const link = await screen.findByRole("link", { name: "Preview" });
        expect(link.getAttribute("href")).toBe("/biz-1/admin/menus/m1/preview");
    });
});
