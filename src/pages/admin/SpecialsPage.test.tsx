// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-25 (checkpoint A): the owner's Specials page lists each special with its dish, prices, schedule and status
// (computed by the backend in the restaurant's time), and lets the owner add, edit, pause/resume and delete.

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("../../api/specialsApi", () => ({ default: api }));
// AGF-S2-36: category specials load beside dish specials
const catApi = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("../../api/categorySpecialsApi", () => ({ default: catApi }));
vi.mock("../../api/menuApi", () => ({ default: { listMenus: vi.fn().mockResolvedValue({ data: [] }), listItems: vi.fn().mockResolvedValue({ data: [] }) } }));

const { default: SpecialsPage } = await import("./SpecialsPage.tsx");

const special = (extra: Record<string, unknown> = {}) => ({
    id: "s1", menuItemId: "i1", itemName: "Doro Wat", menuId: "m1", menuName: "Lunch", categoryName: "Mains",
    regularPrice: 420, specialPrice: 350, currency: "ETB", note: "Happy hour", noteAm: null, startsOn: null, endsOn: null,
    daysOfWeek: ["MONDAY", "FRIDAY"], startTime: "16:00", endTime: "18:00", paused: false, status: "ACTIVE", ...extra,
});

beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    Object.values(catApi).forEach((f) => f.mockReset());
    catApi.list.mockResolvedValue({ data: [] });
    catApi.update.mockResolvedValue({ data: {} });
    catApi.remove.mockResolvedValue({});
    api.update.mockResolvedValue({ data: {} });
    api.remove.mockResolvedValue({});
});
afterEach(() => cleanup());

function renderPage() {
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/admin/specials"]}>
                <Routes><Route path="/:tenantSlug/admin/specials" element={<SpecialsPage />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const row = (name: string) => screen.getByRole("heading", { name }).closest("li") as HTMLElement;

describe("specials page", () => {
    it("explains an empty list and offers to add a special", async () => {
        api.list.mockResolvedValue({ data: [] });
        renderPage();
        expect(await screen.findByText(/No specials yet/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Add special" })).toBeTruthy();
    });

    it("lists dish, menu, prices, schedule and status", async () => {
        api.list.mockResolvedValue({ data: [
            special(),
            special({ id: "s2", menuItemId: "i2", itemName: "Shiro", daysOfWeek: [], startTime: null, endTime: null,
                startsOn: "2026-11-10", endsOn: "2026-11-30", status: "SCHEDULED", note: null }),
            special({ id: "s3", menuItemId: "i3", itemName: "Tibs", status: "ENDED" }),
            special({ id: "s4", menuItemId: "i4", itemName: "Kitfo", paused: true, status: "PAUSED" }),
        ] });
        renderPage();
        const doro = within(await screen.findByRole("heading", { name: "Doro Wat" }).then((h) => h.closest("li") as HTMLElement));
        expect(doro.getByText("Active now")).toBeTruthy();
        expect(doro.getByText("Lunch · Mains")).toBeTruthy();
        expect(doro.getByText("ETB 350.00")).toBeTruthy();
        expect(doro.getByText("ETB 420.00").tagName).toBe("S"); // regular price struck through
        expect(doro.getByText("Mon, Fri · 16:00–18:00")).toBeTruthy();
        expect(doro.getByText("Happy hour")).toBeTruthy();
        expect(within(row("Shiro")).getByText("Scheduled")).toBeTruthy();
        expect(within(row("Shiro")).getByText("Every day · 2026-11-10 to 2026-11-30")).toBeTruthy();
        expect(within(row("Tibs")).getByText("Ended")).toBeTruthy();
        expect(within(row("Kitfo")).getByText("Paused")).toBeTruthy();
        expect(within(row("Kitfo")).getByRole("button", { name: "Resume" })).toBeTruthy();
        expect(within(row("Doro Wat")).getByRole("button", { name: "Pause" })).toBeTruthy();
    });

    it("pauses and resumes a special", async () => {
        api.list.mockResolvedValue({ data: [special(), special({ id: "s4", menuItemId: "i4", itemName: "Kitfo", paused: true, status: "PAUSED" })] });
        renderPage();
        fireEvent.click(within(await screen.findByRole("heading", { name: "Doro Wat" }).then((h) => h.closest("li") as HTMLElement)).getByRole("button", { name: "Pause" }));
        await waitFor(() => expect(api.update).toHaveBeenCalledWith("s1", { paused: true }));
        fireEvent.click(within(row("Kitfo")).getByRole("button", { name: "Resume" }));
        await waitFor(() => expect(api.update).toHaveBeenCalledWith("s4", { paused: false }));
    });

    it("deletes a special after confirmation", async () => {
        api.list.mockResolvedValue({ data: [special()] });
        renderPage();
        fireEvent.click(within(await screen.findByRole("heading", { name: "Doro Wat" }).then((h) => h.closest("li") as HTMLElement)).getByRole("button", { name: "Delete" }));
        expect(api.remove).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Delete special" }));
        await waitFor(() => expect(api.remove).toHaveBeenCalledWith("s1"));
    });

    it("shows a load error with a retry", async () => {
        api.list.mockRejectedValueOnce({ response: { status: 500, data: { message: "boom" } } }).mockResolvedValueOnce({ data: [] });
        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: /try again|retry/i }));
        expect(await screen.findByText(/No specials yet/)).toBeTruthy();
    });

    // checkpoint B: PO-approved read-time price guard
    it("flags a special whose dish now costs the same or less", async () => {
        api.list.mockResolvedValue({ data: [special({ regularPrice: 340, status: "NOT_A_DISCOUNT" })] });
        renderPage();
        const doro = within(await screen.findByRole("heading", { name: "Doro Wat" }).then((h) => h.closest("li") as HTMLElement));
        expect(doro.getByText("Not a discount")).toBeTruthy();
        expect(doro.getByText(/regular price \(ETB 340\.00\) is now at or below the special price \(ETB 350\.00\)/)).toBeTruthy();
    });

    // ---- AGF-S2-36: category specials beside dish specials -------------------------------------------------------

    const categorySpecial = (extra: Record<string, unknown> = {}) => ({
        id: "cs1", categoryId: "c2", categoryName: "Desserts", menuId: "m1", menuName: "Lunch", discountPercent: 20,
        note: "Sweet hour", noteAm: null, startsOn: null, endsOn: null, daysOfWeek: [], startTime: "16:00", endTime: "18:00",
        paused: false, status: "ACTIVE", eligibleDishes: 3, ...extra,
    });

    it("lists category specials with their percentage, kind and status", async () => {
        api.list.mockResolvedValue({ data: [special()] });
        catApi.list.mockResolvedValue({ data: [categorySpecial(), categorySpecial({ id: "cs2", categoryId: "c9", categoryName: "Seasonal", eligibleDishes: 0, status: "SCHEDULED" })] });
        renderPage();
        const desserts = within(await screen.findByRole("heading", { name: "Desserts" }).then((h) => h.closest("li") as HTMLElement));
        expect(desserts.getByText("20% off")).toBeTruthy();
        expect(desserts.getByText("Lunch · Category special")).toBeTruthy();
        expect(desserts.getByText("Every day · 16:00–18:00")).toBeTruthy();
        expect(desserts.getByText("Active now")).toBeTruthy();
        expect(within(row("Seasonal")).getByText(/No eligible dishes/)).toBeTruthy();
        expect(within(row("Doro Wat")).getByText("Lunch · Mains")).toBeTruthy(); // dish specials unchanged
    });

    it("keeps Add special for dish specials and adds Add category special", async () => {
        api.list.mockResolvedValue({ data: [] });
        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: "Add special" }));
        expect(await screen.findByRole("heading", { name: "Add special" })).toBeTruthy(); // dish dialog, as before
        cleanup();
        renderPage();
        fireEvent.click(await screen.findByRole("button", { name: "Add category special" }));
        expect(await screen.findByRole("heading", { name: "Add category special" })).toBeTruthy();
    });

    it("pauses and deletes a category special", async () => {
        api.list.mockResolvedValue({ data: [] });
        catApi.list.mockResolvedValue({ data: [categorySpecial()] });
        renderPage();
        fireEvent.click(within(await screen.findByRole("heading", { name: "Desserts" }).then((h) => h.closest("li") as HTMLElement)).getByRole("button", { name: "Pause" }));
        await waitFor(() => expect(catApi.update).toHaveBeenCalledWith("cs1", { paused: true }));
        fireEvent.click(within(row("Desserts")).getByRole("button", { name: "Delete" }));
        fireEvent.click(screen.getByRole("button", { name: "Delete special" }));
        await waitFor(() => expect(catApi.remove).toHaveBeenCalledWith("cs1"));
        expect(api.remove).not.toHaveBeenCalled();
    });
});
