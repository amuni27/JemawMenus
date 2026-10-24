// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S1-14: menu create/edit form defects, and AGF-DEF-01 (menu type missing from the menus list).

const listMenuTypes = vi.fn();
const createMenu = vi.fn();
const updateMenu = vi.fn();
const getMenu = vi.fn();
const listMenus = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { listMenuTypes, createMenu, updateMenu, getMenu, listMenus } }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1" } }) }));
vi.mock("../../hooks/useMenus", () => ({ useMenus: () => ({ deleteMenu: vi.fn() }) }));

const { default: MenuCreatePage } = await import("./MenuCreatePage.tsx");
const { default: MenuEditPage } = await import("./MenuEditPage.tsx");
const { default: MenusListPage } = await import("./MenusListPage.tsx");

const TYPES = [
    { id: "t-lunch", name: "Lunch" },
    { id: "t-dinner", name: "Dinner" },
];

function Where() {
    return <p>At {useLocation().pathname}</p>;
}

function renderAt(path: string) {
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/:tenantSlug/admin/menus" element={<><MenusListPage /><Where /></>} />
                    <Route path="/:tenantSlug/admin/menus/new" element={<MenuCreatePage />} />
                    <Route path="/:tenantSlug/admin/menus/:menuId/edit" element={<MenuEditPage />} />
                </Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const nameInput = () => screen.getAllByRole("textbox")[0] as HTMLInputElement;
const typeSelect = () => screen.getByLabelText("Menu Type") as HTMLSelectElement;
const fieldOf = (label: string) => screen.getByText(label).parentElement as HTMLElement;

async function typesLoaded() {
    await screen.findByRole("option", { name: "Dinner" });
}

describe("menu create form", () => {
    beforeEach(() => {
        [listMenuTypes, createMenu, updateMenu, getMenu, listMenus].forEach((m) => m.mockReset());
        listMenuTypes.mockResolvedValue({ data: TYPES });
        listMenus.mockResolvedValue({ status: 200, data: [] });
    });
    afterEach(() => cleanup());

    it("creates a menu with an empty description and returns to the list (AC1)", async () => {
        createMenu.mockResolvedValue({ status: 201, data: { id: "m1" } });
        renderAt("/biz-1/admin/menus/new");
        await typesLoaded();

        fireEvent.change(nameInput(), { target: { value: "Lunch Specials" } });
        fireEvent.change(typeSelect(), { target: { value: "t-lunch" } });
        fireEvent.click(screen.getByRole("button", { name: "Save Menu" }));

        expect(await screen.findByText("At /biz-1/admin/menus")).toBeTruthy();
        expect(createMenu).toHaveBeenCalledWith({ name: "Lunch Specials", menuTypeId: "t-lunch", description: "", visibility: "PUBLIC", isActive: false });
    });

    it("shows 'Name is required' under Name only, and nothing under Description (AC2)", async () => {
        renderAt("/biz-1/admin/menus/new");
        await typesLoaded();

        fireEvent.change(typeSelect(), { target: { value: "t-lunch" } });
        fireEvent.click(screen.getByRole("button", { name: "Save Menu" }));

        expect(within(fieldOf("Menu Name")).getByText("Name is required")).toBeTruthy();
        expect(screen.getAllByText("Name is required")).toHaveLength(1);
        expect(within(fieldOf("Description (optional)")).queryByText(/required/)).toBeNull();
        expect(within(fieldOf("Menu Type")).queryByText(/required/)).toBeNull();
        expect(createMenu).not.toHaveBeenCalled();
    });

    it("shows the menu type error under Menu Type", async () => {
        renderAt("/biz-1/admin/menus/new");
        await typesLoaded();

        fireEvent.change(nameInput(), { target: { value: "Lunch" } });
        fireEvent.click(screen.getByRole("button", { name: "Save Menu" }));

        expect(within(fieldOf("Menu Type")).getByText("Menu type is required")).toBeTruthy();
        expect(screen.queryByText("Name is required")).toBeNull();
    });

    it("shows a saving state, then the API error, and stays on the form (AC6)", async () => {
        let reject!: (e: unknown) => void;
        createMenu.mockReturnValue(new Promise((_, r) => (reject = r)));
        renderAt("/biz-1/admin/menus/new");
        await typesLoaded();

        fireEvent.change(nameInput(), { target: { value: "Lunch" } });
        fireEvent.change(typeSelect(), { target: { value: "t-lunch" } });
        fireEvent.click(screen.getByRole("button", { name: "Save Menu" }));

        const saving = await screen.findByRole("button", { name: "Saving…" });
        expect((saving as HTMLButtonElement).disabled).toBe(true);

        reject({ response: { status: 400, data: { message: "Invalid menu type" } } });

        expect((await screen.findByRole("alert")).textContent).toBe("Invalid menu type");
        expect(screen.queryByText(/^At /)).toBeNull();
        expect((screen.getByRole("button", { name: "Save Menu" }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("renders a single form, without the unused multi-step stepper", async () => {
        renderAt("/biz-1/admin/menus/new");
        await typesLoaded();
        expect(screen.queryByText("Menu Settings")).toBeNull();
        expect(screen.queryByText("Publish & Review")).toBeNull();
    });
});

describe("menu edit form", () => {
    beforeEach(() => {
        [listMenuTypes, createMenu, updateMenu, getMenu, listMenus].forEach((m) => m.mockReset());
        listMenuTypes.mockResolvedValue({ data: TYPES });
        listMenus.mockResolvedValue({ status: 200, data: [] });
        updateMenu.mockResolvedValue({ status: 200, data: {} });
    });
    afterEach(() => cleanup());

    const PRIVATE_MENU = {
        id: "m1", businessId: "biz-1", name: "Staff Menu", description: "For staff",
        menuTypeId: "t-lunch", menuTypeName: "Lunch", visibility: "PRIVATE", active: false,
    };

    it("keeps a PRIVATE menu private when only the name changes (AC3)", async () => {
        getMenu.mockResolvedValue({ data: PRIVATE_MENU });
        renderAt("/biz-1/admin/menus/m1/edit");
        await typesLoaded();
        await waitFor(() => expect(nameInput().value).toBe("Staff Menu"));

        fireEvent.change(nameInput(), { target: { value: "Staff Meals" } });
        fireEvent.click(screen.getByRole("button", { name: "Update" }));

        await waitFor(() => expect(updateMenu).toHaveBeenCalled());
        expect(updateMenu.mock.calls[0][1]).toMatchObject({ name: "Staff Meals", visibility: "PRIVATE" });
        expect(await screen.findByText("At /biz-1/admin/menus")).toBeTruthy();
    });

    it("sends the newly selected menu type (AC4)", async () => {
        getMenu.mockResolvedValue({ data: PRIVATE_MENU });
        renderAt("/biz-1/admin/menus/m1/edit");
        await typesLoaded();
        await waitFor(() => expect(typeSelect().value).toBe("t-lunch"));

        fireEvent.change(typeSelect(), { target: { value: "t-dinner" } });
        fireEvent.click(screen.getByRole("button", { name: "Update" }));

        await waitFor(() => expect(updateMenu).toHaveBeenCalled());
        expect(updateMenu.mock.calls[0]).toEqual(["m1", expect.objectContaining({ menuTypeId: "t-dinner", visibility: "PRIVATE" })]);
    });

    it("lets the owner clear the description", async () => {
        getMenu.mockResolvedValue({ data: PRIVATE_MENU });
        renderAt("/biz-1/admin/menus/m1/edit");
        await typesLoaded();
        const description = await screen.findByDisplayValue("For staff");

        fireEvent.change(description, { target: { value: "" } });
        fireEvent.click(screen.getByRole("button", { name: "Update" }));

        await waitFor(() => expect(updateMenu).toHaveBeenCalled());
        expect(updateMenu.mock.calls[0][1]).toMatchObject({ description: "" });
    });

    it("shows the API error and stays on the edit form (AC6)", async () => {
        getMenu.mockResolvedValue({ data: PRIVATE_MENU });
        updateMenu.mockRejectedValue({ response: { status: 400, data: { message: "Invalid menu type" } } });
        renderAt("/biz-1/admin/menus/m1/edit");
        await typesLoaded();
        await waitFor(() => expect(nameInput().value).toBe("Staff Menu"));

        fireEvent.click(screen.getByRole("button", { name: "Update" }));

        expect((await screen.findByRole("alert")).textContent).toBe("Invalid menu type");
        expect(screen.queryByText(/^At /)).toBeNull();
    });
});

describe("menus list (AGF-DEF-01)", () => {
    afterEach(() => cleanup());

    it("shows each menu's type from menuTypeName", async () => {
        listMenus.mockResolvedValue({
            status: 200,
            data: [{ id: "m1", businessId: "biz-1", name: "All-Day Menu", menuTypeId: "t-lunch", menuTypeName: "Lunch", visibility: "PUBLIC" }],
        });
        renderAt("/biz-1/admin/menus");

        expect((await screen.findAllByText("Lunch")).length).toBeGreaterThan(0);
    });
});
