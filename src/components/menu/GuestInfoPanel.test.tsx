// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../ui/ToastContext";

// AGF-S2-03: under the guest header, guests see open/closed status, today's hours, a call link and a map link.

const menuData = vi.hoisted(() => ({ value: { business: {} as Record<string, unknown>, menus: [] as unknown[] } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const { default: GuestInfoPanel } = await import("./GuestInfoPanel");
const { default: CustomerMenu } = await import("../../pages/customer/CustomerMenu.tsx");

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const hours = DAYS.map((d) => d === "SUNDAY"
    ? { dayOfWeek: d, isOpen: false, startTime: null, endTime: null }
    : { dayOfWeek: d, isOpen: true, startTime: "08:00", endTime: "22:00" });

const business = {
    id: "biz-1", name: "Abol Cafe", open24_7: false, hours, timeZone: "Africa/Addis_Ababa",
    businessPhone: "+251 11 000 0000", streetAddress: "Bole Road 1", city: "Addis Ababa", state: "Addis Ababa",
};

beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});
beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T18:00:00Z")); // Wednesday 21:00 in Addis Ababa
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});
afterAll(() => vi.unstubAllGlobals());

const panel = () => screen.getByRole("region", { name: "Restaurant information" });

describe("guest info panel", () => {
    it("shows open status, today's hours, a call link and a map link", () => {
        render(<GuestInfoPanel business={business} />);
        expect(within(panel()).getByText("Open now · until 22:00")).toBeTruthy();
        expect(within(panel()).getByText("Today 08:00–22:00")).toBeTruthy();

        const call = within(panel()).getByRole("link", { name: /call \+251 11 000 0000/i }) as HTMLAnchorElement;
        expect(call.getAttribute("href")).toBe("tel:+251110000000");

        const map = within(panel()).getByRole("link", { name: /bole road 1, addis ababa/i }) as HTMLAnchorElement;
        expect(map.getAttribute("href")).toBe("https://www.google.com/maps/search/?api=1&query=Bole%20Road%201%2C%20Addis%20Ababa");
        expect(map.target).toBe("_blank");
        expect(map.rel).toContain("noopener");
        // the region equal to the city is not repeated
        expect(map.textContent).toBe("Bole Road 1, Addis Ababa");
    });

    it("shows 'Closed today' with the next opening on a closed day", () => {
        vi.setSystemTime(new Date("2026-10-25T09:00:00Z")); // Sunday 12:00
        render(<GuestInfoPanel business={business} />);
        expect(within(panel()).getByText("Closed today · opens tomorrow 08:00")).toBeTruthy();
        expect(within(panel()).getByText("Today: closed")).toBeTruthy();
    });

    it("shows 'Open 24 hours' for 24/7 businesses", () => {
        render(<GuestInfoPanel business={{ ...business, open24_7: true, hours: [] }} />);
        expect(within(panel()).getByText("Open 24 hours")).toBeTruthy();
    });

    it("shows no call link without a phone, and no map link without an address (AC4)", () => {
        render(<GuestInfoPanel business={{ ...business, businessPhone: "  ", streetAddress: null, city: null, state: null }} />);
        expect(within(panel()).queryByRole("link", { name: /call/i })).toBeNull();
        expect(within(panel()).queryByRole("link")).toBeNull();
        expect(within(panel()).getByText("Open now · until 22:00")).toBeTruthy();
    });

    it("shows contact details without a status when no hours are stored", () => {
        render(<GuestInfoPanel business={{ ...business, hours: [] }} />);
        expect(within(panel()).queryByText(/open|closed/i)).toBeNull();
        expect(within(panel()).getByRole("link", { name: /call/i })).toBeTruthy();
    });

    it("renders nothing when there is nothing to show", () => {
        const { container } = render(<GuestInfoPanel business={{ hours: [], businessPhone: null }} />);
        expect(container.innerHTML).toBe("");
    });
});

describe("guest menu page", () => {
    it("shows the info panel under the header", () => {
        menuData.value = { business, menus: [] };
        render(
            <ToastProvider>
                <MemoryRouter initialEntries={["/biz-1/menu"]}>
                    <Routes><Route path="/:tenantSlug/menu" element={<CustomerMenu />} /></Routes>
                </MemoryRouter>
            </ToastProvider>
        );
        expect(within(panel()).getByText("Open now · until 22:00")).toBeTruthy();
        const header = screen.getByRole("banner");
        expect(header.compareDocumentPosition(panel()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});
