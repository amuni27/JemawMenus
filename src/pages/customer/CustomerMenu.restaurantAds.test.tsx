// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";
import { RESTAURANT_ADS_NOTICE, SPONSORED_NOTICE } from "./PrivacyNotice";

// AGF E4-M8 (AC15, Q-M8-12): the Model 3 privacy sentence appears only when the menu says restaurant ads apply
// (restaurantAdsNotice), also without an ad on screen; the existing Model 2 sentence is unchanged.

const menuData = vi.hoisted(() => ({ value: { business: {} as Record<string, unknown>, menus: [] as unknown[], sponsored: undefined as unknown,
    restaurantAdsNotice: undefined as boolean | undefined } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});
afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); });

function privacyText(restaurantAdsNotice?: boolean) {
    menuData.value = { business: { id: "biz-1", name: "Abol Cafe", timeZone: "Africa/Addis_Ababa" }, menus: [], sponsored: undefined, restaurantAdsNotice };
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes><Route path="/:tenantSlug/menu" element={<CustomerMenu />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
    return screen.getByRole("dialog").textContent ?? "";
}

describe("the Model 3 privacy sentence on the guest menu", () => {
    it("appears when restaurant ads apply, even with no ad shown", () => {
        const text = privacyText(true);
        expect(text).toContain(RESTAURANT_ADS_NOTICE);
        expect(text).toContain(SPONSORED_NOTICE);
    });

    it("doesn't appear otherwise", () => {
        const text = privacyText(undefined);
        expect(text).not.toContain(RESTAURANT_ADS_NOTICE);
        expect(text).toContain(SPONSORED_NOTICE); // Model 2 behaviour unchanged
    });
});
