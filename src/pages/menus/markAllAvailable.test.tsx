// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-19: "Mark all available" on the menu page: confirmation with the sold-out count, one bulk request,
// the server's count in the success message, no false success on failure, and no double submission.

const getMenu = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { getMenu, updateMenu: vi.fn() } }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1" } }) }));
vi.mock("../../components/menu/ItemsPanel.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/ItemModal.tsx", () => ({ default: () => null }));
vi.mock("../../api/categoriesApi.ts", () => ({
    default: { getCategories: vi.fn().mockResolvedValue({ data: [] }), updateCategory: vi.fn(), createCategory: vi.fn(), deleteCategory: vi.fn() },
}));

const hook = vi.hoisted(() => ({ items: [] as { id: string; status: string }[], markAllAvailable: vi.fn() }));
vi.mock("../../hooks/useItems.ts", () => ({ useItems: () => hook }));

const { default: MenuDetailPage } = await import("./MenuDetailPage.tsx");

const items = (statuses: string[]) => statuses.map((status, i) => ({ id: `i${i}`, status }));

beforeEach(() => {
    getMenu.mockReset();
    getMenu.mockResolvedValue({ data: { id: "m1", businessId: "biz-1", name: "Lunch", visibility: "PUBLIC", active: true } });
    hook.markAllAvailable.mockReset();
});
afterEach(() => cleanup());

async function renderPage(statuses: string[]) {
    hook.items = items(statuses);
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/admin/menus/m1"]}>
                <Routes>
                    <Route path="/:tenantSlug/admin/menus/:menuId" element={<MenuDetailPage />} />
                </Routes>
            </MemoryRouter>
        </ToastProvider>
    );
    return (await screen.findByRole("button", { name: "Mark all available" })) as HTMLButtonElement;
}

const dialog = () => screen.getByRole("dialog", { name: "Mark all available" });

describe("Mark all available", () => {
    it("is disabled when the menu has no sold-out items", async () => {
        const button = await renderPage(["AVAILABLE", "UNAVAILABLE"]);
        expect(button.disabled).toBe(true);
    });

    it("asks for confirmation with the number of sold-out items", async () => {
        const button = await renderPage(["OUT_OF_STOCK", "OUT_OF_STOCK", "AVAILABLE", "UNAVAILABLE", "OUT_OF_STOCK"]);
        expect(button.disabled).toBe(false);
        fireEvent.click(button);
        expect(within(dialog()).getByText("Mark 3 sold-out items as available?")).toBeTruthy();
        fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(hook.markAllAvailable).not.toHaveBeenCalled();
    });

    it("uses singular wording for one item", async () => {
        fireEvent.click(await renderPage(["OUT_OF_STOCK", "AVAILABLE"]));
        expect(within(dialog()).getByText("Mark 1 sold-out item as available?")).toBeTruthy();
    });

    it("confirms, reports the server's count and closes", async () => {
        hook.markAllAvailable.mockResolvedValue(2); // one item changed elsewhere in the meantime
        fireEvent.click(await renderPage(["OUT_OF_STOCK", "OUT_OF_STOCK", "OUT_OF_STOCK"]));
        fireEvent.click(within(dialog()).getByRole("button", { name: "Mark available" }));
        expect(await screen.findByText("2 items marked available")).toBeTruthy();
        expect(hook.markAllAvailable).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("prevents double submission while the request is running", async () => {
        let resolve: (n: number) => void = () => {};
        hook.markAllAvailable.mockReturnValue(new Promise<number>((r) => { resolve = r; }));
        fireEvent.click(await renderPage(["OUT_OF_STOCK"]));
        fireEvent.click(within(dialog()).getByRole("button", { name: "Mark available" }));
        const busy = within(dialog()).getByRole("button", { name: "Marking…" }) as HTMLButtonElement;
        expect(busy.disabled).toBe(true);
        fireEvent.click(busy);
        expect(hook.markAllAvailable).toHaveBeenCalledTimes(1);
        resolve(1);
        expect(await screen.findByText("1 item marked available")).toBeTruthy();
    });

    it("shows a clear error and no success message when it fails", async () => {
        hook.markAllAvailable.mockRejectedValue({ response: { status: 500, data: { message: "Server error" } } });
        fireEvent.click(await renderPage(["OUT_OF_STOCK", "OUT_OF_STOCK"]));
        fireEvent.click(within(dialog()).getByRole("button", { name: "Mark available" }));
        expect(await within(dialog()).findByRole("alert")).toHaveProperty("textContent", "Server error");
        expect(screen.queryByText(/marked available/)).toBeNull();
        expect((within(dialog()).getByRole("button", { name: "Mark available" }) as HTMLButtonElement).disabled).toBe(false);
    });
});
