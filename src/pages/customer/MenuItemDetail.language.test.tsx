// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";
import { GuestLanguageProvider } from "../../components/menu/Localized";

// AGF-S2-23 (checkpoint B): the dish detail page uses the selected language, field by field.

const get = vi.fn();
vi.mock("../../services/apiPublic.ts", () => ({ default: { get } }));

const { default: MenuItemDetail } = await import("./MenuItemDetail.tsx");

afterEach(() => cleanup());

const GuestMenuStub = () => <Outlet context={{ addToWaiterList: vi.fn() }} />;

function renderDetail(lang: "en" | "am", item: Record<string, unknown>) {
    get.mockResolvedValue({ data: { id: "i1", price: 350, ingredients: ["chicken"], status: "AVAILABLE", ...item } });
    render(
        <ToastProvider>
            <GuestLanguageProvider value={{ lang, available: true, setLang: () => {} }}>
                <MemoryRouter initialEntries={["/biz-1/menu/item/i1"]}>
                    <Routes>
                        <Route path="/:tenantSlug/menu" element={<GuestMenuStub />}>
                            <Route path="item/:itemId" element={<MenuItemDetail />} />
                        </Route>
                    </Routes>
                </MemoryRouter>
            </GuestLanguageProvider>
        </ToastProvider>
    );
}

describe("dish detail language", () => {
    it("shows the Amharic name and description when Amharic is selected", async () => {
        renderDetail("am", { name: "Doro Wat", description: "Chicken stew", nameAm: "ዶሮ ወጥ", descriptionAm: "የዶሮ ወጥ" });
        const title = await screen.findByRole("heading", { name: "ዶሮ ወጥ" });
        expect(title.querySelector("[lang]")?.getAttribute("lang")).toBe("am");
        expect(screen.getByText("የዶሮ ወጥ")).toBeTruthy();
    });

    it("keeps the main text for untranslated fields and in English", async () => {
        renderDetail("am", { name: "Beef Tibs", description: "Sautéed beef", nameAm: null });
        expect(await screen.findByRole("heading", { name: "Beef Tibs" })).toBeTruthy();
        cleanup();
        renderDetail("en", { name: "Doro Wat", description: "Chicken stew", nameAm: "ዶሮ ወጥ" });
        expect(await screen.findByRole("heading", { name: "Doro Wat" })).toBeTruthy();
    });
});
