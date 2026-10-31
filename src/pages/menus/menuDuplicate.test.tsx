// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-18: "Duplicate" on the Menus list: one labelled action per menu, the copy's page opens afterwards with a
// toast that reports what was copied (and images that couldn't be), Cancel returns focus to the action.

const listMenus = vi.fn();
const duplicateMenu = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { listMenus, duplicateMenu } }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1" } }) }));
vi.mock("../../hooks/useMenus", () => ({ useMenus: () => ({ deleteMenu: vi.fn() }) }));

const { default: MenusListPage } = await import("./MenusListPage.tsx");

const menus = [
    { id: "m1", businessId: "biz-1", name: "All-Day Menu", menuTypeName: "Lunch", active: true, visibility: "PUBLIC", createdAt: "", updatedAt: "" },
    { id: "m3", businessId: "biz-1", name: "Breakfast", menuTypeName: "Breakfast", active: false, visibility: "PUBLIC", createdAt: "", updatedAt: "" },
];

beforeEach(() => {
    listMenus.mockReset();
    listMenus.mockResolvedValue({ data: menus });
    duplicateMenu.mockReset();
});
afterEach(() => cleanup());

function renderPage() {
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/admin/menus"]}>
                <Routes>
                    <Route path="/:tenantSlug/admin/menus" element={<MenusListPage />} />
                    <Route path="/:tenantSlug/admin/menus/:menuId" element={<p>Menu page opened</p>} />
                </Routes>
            </MemoryRouter>
        </ToastProvider>,
    );
}

async function duplicateButtons(name: string) {
    return screen.findAllByRole("button", { name: `Duplicate ${name}` });
}

describe("Duplicate on the Menus list", () => {
    it("has a Duplicate action named after each menu (phone cards and desktop table)", async () => {
        renderPage();

        expect(await duplicateButtons("All-Day Menu")).toHaveLength(2);
        expect(await duplicateButtons("Breakfast")).toHaveLength(2);
    });

    it("duplicates the chosen menu, opens the copy and reports what was copied", async () => {
        duplicateMenu.mockResolvedValue({
            data: { menu: { ...menus[0], id: "m2", name: "All-Day Menu (copy)" }, categoriesCopied: 2, itemsCopied: 11, imagesNotCopied: 0 },
        });
        renderPage();

        fireEvent.click((await duplicateButtons("All-Day Menu"))[0]);
        const dialog = screen.getByRole("dialog", { name: "Duplicate menu" });
        fireEvent.click(within(dialog).getByRole("button", { name: "Duplicate" }));

        expect(await screen.findByText("Menu page opened")).toBeTruthy();
        expect(duplicateMenu).toHaveBeenCalledWith("m1", "All-Day Menu (copy)");
        expect(screen.getByText("Menu duplicated: 11 items copied")).toBeTruthy();
    });

    it("says how many images couldn't be copied", async () => {
        duplicateMenu.mockResolvedValue({
            data: { menu: { ...menus[0], id: "m2" }, categoriesCopied: 1, itemsCopied: 1, imagesNotCopied: 1 },
        });
        renderPage();

        fireEvent.click((await duplicateButtons("All-Day Menu"))[0]);
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Duplicate" }));

        expect(await screen.findByText("Menu duplicated: 1 item copied. 1 image couldn't be copied.")).toBeTruthy();
    });

    it("Cancel closes the dialog without a request and returns focus to the Duplicate action", async () => {
        renderPage();

        const button = (await duplicateButtons("Breakfast"))[1];
        button.focus();
        fireEvent.click(button);
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        expect(document.activeElement).toBe(button);
        expect(duplicateMenu).not.toHaveBeenCalled();
    });
});
