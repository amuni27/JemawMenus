// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-23 (checkpoint B): the guest language switch. Shown only when the restaurant has Amharic text; አማርኛ shows
// the Amharic text field by field (untranslated ones stay in the main text), marked lang="am"; the choice is
// remembered on the device; the first visit follows the browser language; search covers both languages.

const menuData = vi.hoisted(() => ({ value: { business: {} as Record<string, unknown>, menus: [] as unknown[] } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

const item = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, price: 100, status: "AVAILABLE", ...extra });
const translated = {
    id: "m1", name: "Lunch", nameAm: "ምሳ", currency: "ETB", categories: [
        { id: "c1", menuId: "m1", name: "Mains", nameAm: "ዋና ምግቦች", sortOrder: 0, items: [
            item("i1", "Doro Wat", { description: "Chicken stew", nameAm: "ዶሮ ወጥ", descriptionAm: "የዶሮ ወጥ" }),
            item("i2", "Beef Tibs", { description: "Sautéed beef" }),
        ] },
        { id: "c2", menuId: "m1", name: "Drinks", sortOrder: 1, items: [item("i3", "Buna", { nameAm: "ቡና" })] },
    ],
};
const englishOnly = {
    id: "m2", name: "Lunch", currency: "ETB", categories: [
        { id: "c9", menuId: "m2", name: "Mains", sortOrder: 0, items: [item("i9", "Doro Wat")] },
    ],
};

let browserLanguage = "en-US";
beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});
beforeEach(() => {
    browserLanguage = "en-US";
    vi.spyOn(window.navigator, "language", "get").mockImplementation(() => browserLanguage);
});
afterEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
});

function renderMenu(menus: unknown[]) {
    menuData.value = { business: { id: "biz-1", name: "Abol Cafe" }, menus };
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes><Route path="/:tenantSlug/menu" element={<CustomerMenu />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const main = () => screen.getByRole("main");
const switchGroup = () => screen.queryByRole("group", { name: "Menu language" });
const english = () => within(switchGroup()!).getByRole("button", { name: "English" });
const amharic = () => within(switchGroup()!).getByRole("button", { name: "አማርኛ" });
const dishNames = () => within(main()).queryAllByRole("heading", { level: 3 }).map((n) => n.textContent?.trim());

describe("guest language switch", () => {
    it("isn't shown when the restaurant has no Amharic text", () => {
        renderMenu([englishOnly]);
        expect(switchGroup()).toBeNull();
        expect(dishNames()).toEqual(["Doro Wat"]);
    });

    it("starts in English and shows Amharic field by field, marked lang=am", () => {
        renderMenu([translated]);
        expect(english().getAttribute("aria-pressed")).toBe("true");
        expect(amharic().getAttribute("aria-pressed")).toBe("false");
        expect(amharic().getAttribute("lang")).toBe("am");
        expect(dishNames()).toEqual(["Doro Wat", "Beef Tibs", "Buna"]);

        fireEvent.click(amharic());
        expect(amharic().getAttribute("aria-pressed")).toBe("true");
        expect(dishNames()).toEqual(["ዶሮ ወጥ", "Beef Tibs", "ቡና"]); // Beef Tibs has no translation
        expect(within(main()).getByText("ዶሮ ወጥ").closest("[lang]")?.getAttribute("lang")).toBe("am");
        expect(within(main()).getByText("የዶሮ ወጥ").closest("[lang]")?.getAttribute("lang")).toBe("am");
        expect(within(main()).getByText("Sautéed beef")).toBeTruthy(); // untranslated description stays
        expect(within(main()).getByRole("heading", { level: 2, name: "ዋና ምግቦች" })).toBeTruthy();
        expect(within(main()).getByRole("heading", { level: 2, name: "Drinks" })).toBeTruthy();
        expect(screen.getAllByText("ምሳ").length).toBeGreaterThan(0); // menu picker
        expect(screen.getByRole("button", { name: "Add ዶሮ ወጥ" })).toBeTruthy();
    });

    it("remembers the choice on the device", () => {
        renderMenu([translated]);
        fireEvent.click(amharic());
        expect(localStorage.getItem("agafari:guest-language")).toBe(JSON.stringify("am"));
        cleanup();
        renderMenu([translated]);
        expect(dishNames()[0]).toBe("ዶሮ ወጥ");
        fireEvent.click(english());
        expect(dishNames()[0]).toBe("Doro Wat");
    });

    it("follows an Amharic browser on the first visit", () => {
        browserLanguage = "am-ET";
        renderMenu([translated]);
        expect(amharic().getAttribute("aria-pressed")).toBe("true");
        expect(dishNames()[0]).toBe("ዶሮ ወጥ");
    });

    it("shows the main text for a restaurant without Amharic even if Amharic was chosen elsewhere", () => {
        localStorage.setItem("agafari:guest-language", JSON.stringify("am"));
        renderMenu([englishOnly]);
        expect(dishNames()).toEqual(["Doro Wat"]);
    });

    it("finds dishes by their Amharic name while English is selected", () => {
        renderMenu([translated]);
        fireEvent.change(screen.getByRole("searchbox", { name: "Search menu items" }), { target: { value: "ዶሮ" } });
        expect(dishNames()).toEqual(["Doro Wat"]);
    });

    it("lists a dish added in Amharic under its Amharic name in the waiter list", () => {
        renderMenu([translated]);
        fireEvent.click(amharic());
        fireEvent.click(screen.getByRole("button", { name: "Add ዶሮ ወጥ" }));
        fireEvent.click(screen.getByRole("button", { name: "View order" }));
        const dialog = screen.getByRole("dialog");
        expect(within(dialog).getByText("ዶሮ ወጥ")).toBeTruthy();
        fireEvent.click(english()); // switching back renders the English name from the same entry
        expect(within(screen.getByRole("dialog")).getByText("Doro Wat")).toBeTruthy();
    });
});
