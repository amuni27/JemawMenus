// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { publicMenuUrl } from "../../utils/publicMenuUrl";

// AGF-S2-09: the owner dashboard shows menus by status, sold-out items with a link to the filtered items view,
// a "Menu coming soon" warning when nothing is live, and quick actions. Data comes from the owner's own APIs.

const listMenus = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { listMenus } }));
const listSoldOut = vi.fn();
vi.mock("../../api/itemsApi.ts", () => ({ default: { listSoldOut } }));
const getViews = vi.fn(); // AGF-S2-24
vi.mock("../../api/menuViewsApi", () => ({ default: { get: getViews } }));

const { default: Dashboard } = await import("./Dashboard.tsx");

const menu = (id: string, name: string, active: boolean, visibility = "PUBLIC") => ({ id, name, active, visibility });
const soldOut = (id: string, name: string, menuId: string) => ({ id, name, menuId, categoryId: "c", status: "OUT_OF_STOCK" });

beforeEach(() => {
    [listMenus, listSoldOut, getViews].forEach((m) => m.mockReset());
    listSoldOut.mockResolvedValue({ data: [] });
    getViews.mockResolvedValue({ data: { timeZone: "Africa/Addis_Ababa", today: 0, days: [] } });
});
afterEach(() => cleanup());

function renderDashboard() {
    render(
        <MemoryRouter initialEntries={["/biz-1/admin"]}>
            <Routes><Route path="/:tenantSlug/admin" element={<Dashboard />} /></Routes>
        </MemoryRouter>
    );
}

const count = (label: string) => screen.getByTestId(`menus-${label.toLowerCase()}`).textContent;

describe("owner dashboard", () => {
    it("counts menus as Live, Private and Unpublished from the owner's menus", async () => {
        listMenus.mockResolvedValue({ data: [
            menu("m1", "All-Day", true), menu("m2", "Brunch", true), menu("m3", "Staff", true, "PRIVATE"), menu("m4", "Drafts", false),
        ] });
        renderDashboard();

        expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeTruthy();
        await waitFor(() => expect(count("Live")).toBe("2"));
        expect(count("Private")).toBe("1");
        expect(count("Unpublished")).toBe("1");
        expect(screen.queryByText(/Menu coming soon/)).toBeNull();
        // sold-out counts are read for each of the owner's menus
        expect(listSoldOut.mock.calls.map((c) => c[0]).sort()).toEqual(["m1", "m2", "m3", "m4"]);
    });

    it("warns that guests see 'Menu coming soon' when no menu is live, with a link to Menus (AC1)", async () => {
        listMenus.mockResolvedValue({ data: [menu("m3", "Staff", true, "PRIVATE"), menu("m4", "Drafts", false)] });
        renderDashboard();

        const warning = await screen.findByRole("status", { name: "Menu coming soon" });
        expect(warning.textContent).toContain('Guests see "Menu coming soon" — publish a menu');
        expect(within(warning).getByRole("link", { name: "Go to Menus" }).getAttribute("href")).toBe("/biz-1/admin/menus");
    });

    it("links '3 items sold out' to the filtered items view (AC2)", async () => {
        listMenus.mockResolvedValue({ data: [menu("m1", "All-Day", true), menu("m2", "Brunch", true)] });
        listSoldOut.mockImplementation((menuId: string) => Promise.resolve({ data: menuId === "m1"
            ? [soldOut("i1", "Tibs", "m1"), soldOut("i2", "Shiro", "m1")]
            : [soldOut("i3", "Coffee", "m2")] }));
        renderDashboard();

        const link = await screen.findByRole("link", { name: "3 items sold out" });
        expect(link.getAttribute("href")).toBe("/biz-1/admin/menus/m1?stock=sold-out");
        // when several menus have sold-out items, each gets its own link
        expect(screen.getByRole("link", { name: "All-Day: 2 sold out" }).getAttribute("href")).toBe("/biz-1/admin/menus/m1?stock=sold-out");
        expect(screen.getByRole("link", { name: "Brunch: 1 sold out" }).getAttribute("href")).toBe("/biz-1/admin/menus/m2?stock=sold-out");
    });

    it("uses singular and zero wording", async () => {
        listMenus.mockResolvedValue({ data: [menu("m1", "All-Day", true)] });
        listSoldOut.mockResolvedValue({ data: [soldOut("i1", "Tibs", "m1")] });
        renderDashboard();
        expect(await screen.findByRole("link", { name: "1 item sold out" })).toBeTruthy();
        cleanup();

        listSoldOut.mockResolvedValue({ data: [] });
        renderDashboard();
        expect(await screen.findByText("No items sold out")).toBeTruthy();
        expect(screen.queryByRole("link", { name: /sold out/ })).toBeNull();
    });

    it("offers the quick actions: create menu, view QR code, open guest menu", async () => {
        listMenus.mockResolvedValue({ data: [menu("m1", "All-Day", true)] });
        renderDashboard();

        expect((await screen.findByRole("link", { name: "Create menu" })).getAttribute("href")).toBe("/biz-1/admin/menus/new");
        expect(screen.getByRole("link", { name: "View QR code" }).getAttribute("href")).toBe("/biz-1/admin/qrcode");
        const guest = screen.getByRole("link", { name: /Open guest menu/ }) as HTMLAnchorElement;
        expect(guest.getAttribute("href")).toBe(publicMenuUrl("biz-1"));
        expect(guest.target).toBe("_blank");
        expect(guest.rel).toContain("noopener");
    });

    // AGF-S2-20: an invalid configured address fails closed
    it("shows 'Guest menu link unavailable' instead of the guest link when the address is invalid", async () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "http://menu.example.test");
        listMenus.mockResolvedValue({ data: [menu("m1", "All-Day", true)] });
        renderDashboard();

        expect(await screen.findByText("Guest menu link unavailable")).toBeTruthy();
        expect(screen.queryByRole("link", { name: /Open guest menu/ })).toBeNull();
        vi.unstubAllEnvs();
    });

    it("handles a business with no menus yet", async () => {
        listMenus.mockResolvedValue({ data: [] });
        renderDashboard();

        expect(await screen.findByText("You have no menus yet.")).toBeTruthy();
        expect(count("Live")).toBe("0");
        expect(screen.getByRole("status", { name: "Menu coming soon" })).toBeTruthy();
        expect(screen.getByText("No items sold out")).toBeTruthy();
        expect(listSoldOut).not.toHaveBeenCalled();
    });

    it("shows loading, then an error with Retry that loads again (AC3)", async () => {
        listMenus.mockRejectedValueOnce({ response: { status: 500, data: { message: "Something went wrong. Please try again." } } })
            .mockResolvedValueOnce({ data: [menu("m1", "All-Day", true)] });
        renderDashboard();
        expect(screen.getByText("Loading dashboard…")).toBeTruthy();

        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toContain("Something went wrong. Please try again.");
        fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

        await waitFor(() => expect(count("Live")).toBe("1"));
        expect(listMenus).toHaveBeenCalledTimes(2);
    });

    it("shows an error with Retry when the sold-out items cannot be loaded", async () => {
        listMenus.mockResolvedValue({ data: [menu("m1", "All-Day", true)] });
        listSoldOut.mockRejectedValueOnce({ code: "ERR_NETWORK", message: "Network Error" });
        renderDashboard();

        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toContain("Could not reach the server.");
        fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
        expect(await screen.findByText("No items sold out")).toBeTruthy();
    });

    // AGF-S2-24
    it("shows the Menu views card for the owner's restaurant", async () => {
        listMenus.mockResolvedValue({ data: [menu("m1", "All-Day", true)] });
        renderDashboard();
        expect(await screen.findByRole("heading", { name: "Menu views" })).toBeTruthy();
        expect(getViews).toHaveBeenCalledWith("biz-1", 30);
    });

    it("keeps the rest of the dashboard when the views can't be loaded", async () => {
        listMenus.mockResolvedValue({ data: [menu("m1", "All-Day", true)] });
        getViews.mockRejectedValue(new Error("down"));
        renderDashboard();
        expect(await screen.findByText("Views unavailable")).toBeTruthy();
        expect(count("Live")).toBe("1");
        expect(screen.getByRole("heading", { name: "Quick actions" })).toBeTruthy();
    });
});
