// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";

// AGF-S2-06: guests see the allergens, tags, spice level and prep time the owner saved.

const get = vi.fn();
vi.mock("../../services/apiPublic.ts", () => ({ default: { get } }));

const { default: MenuItemDetail } = await import("./MenuItemDetail.tsx");

const GuestMenuStub = () => <Outlet context={{ addToWaiterList: vi.fn() }} />;
const renderItem = (data: Record<string, unknown>) => {
    get.mockResolvedValue({ data: { id: "i1", name: "Beef Tibs", price: 380, ingredients: ["beef"], status: "AVAILABLE", currency: "ETB", ...data } });
    render(
        <MemoryRouter initialEntries={["/biz-1/menu/item/i1"]}>
            <Routes>
                <Route path="/:tenantSlug/menu" element={<GuestMenuStub />}>
                    <Route path="item/:itemId" element={<MenuItemDetail />} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
};

afterEach(cleanup);

describe("guest item detail fields", () => {
    it("shows saved allergens, tags, spice level and prep time (AC1)", async () => {
        renderItem({ allergens: ["gluten", "Mustard"], tags: ["fasting"], spiceLevel: "EXTRA_HOT", prepTimeMinutes: 15 });
        expect(await screen.findByText("Beef Tibs")).toBeTruthy();
        expect(screen.getByText("Allergens")).toBeTruthy();
        expect(screen.getByText("gluten")).toBeTruthy();
        expect(screen.getByText("Mustard")).toBeTruthy();
        expect(screen.getByText("#fasting")).toBeTruthy();
        expect(screen.getByText(/Extra hot/)).toBeTruthy();
        expect(screen.queryByText(/EXTRA_HOT/)).toBeNull();
        expect(screen.getByText(/15 min/)).toBeTruthy();
        expect(screen.getAllByText("ETB 380.00").length).toBeGreaterThan(0);
    });

    it("hides spice level 'None' and shows an unknown stored level as-is", async () => {
        renderItem({ spiceLevel: "NONE" });
        expect(await screen.findByText("Beef Tibs")).toBeTruthy();
        expect(screen.queryByText(/🌶/)).toBeNull();
        cleanup();

        renderItem({ spiceLevel: "VOLCANIC" });
        expect(await screen.findByText(/VOLCANIC/)).toBeTruthy();
    });

    it("shows nothing for missing values", async () => {
        renderItem({ allergens: null, tags: [], spiceLevel: null, prepTimeMinutes: null });
        expect(await screen.findByText("Beef Tibs")).toBeTruthy();
        expect(screen.queryByText("Allergens")).toBeNull();
        expect(screen.queryByText(/#/)).toBeNull();
        expect(screen.queryByText(/🌶|⏱/)).toBeNull();
    });
});
