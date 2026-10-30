// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";
import { publicMenuUrl } from "../../utils/publicMenuUrl";
import { shareUrl } from "../../utils/shareUrl";

// AGF-S2-10: the account page shows the stored subdomain correctly and the same guest menu URL as the QR page.

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => auth.value }));

const { default: AccountPage } = await import("./AccountPage.tsx");

function setBusiness(business: Record<string, unknown>) {
    auth.value = {
        user: { id: "u1", fullName: "Demo Owner", email: "owner@example.com", role: "VENUE" },
        business: { id: "biz-1", name: "Abol Cafe", currency: "ETB", ...business },
        refresh: vi.fn(),
    };
}

function renderPage() {
    render(<ToastProvider><MemoryRouter><AccountPage /></MemoryRouter></ToastProvider>);
}

const valueOf = (label: string) => screen.getByText(label).parentElement!.textContent!.replace(label, "").trim();

beforeEach(() => setBusiness({ customSubdomain: "abol.example.test" }));
afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe("account page subdomain", () => {
    it("shows the stored subdomain without the duplicated '.menuqrs.com' suffix", () => {
        renderPage();
        expect(valueOf("Subdomain")).toBe("abol.example.test");
        expect(document.body.textContent).not.toContain("menuqrs");
    });

    it("shows a bare stored label as-is and '—' when there is none", () => {
        setBusiness({ customSubdomain: "abol" });
        renderPage();
        expect(valueOf("Subdomain")).toBe("abol");
        cleanup();

        setBusiness({ customSubdomain: null });
        renderPage();
        expect(valueOf("Subdomain")).toBe("—");
    });
});

// AGF-S2-12: the saved Google Maps link is shown on the account page (opens in a new tab), or "—"
describe("Google Maps link on the account page", () => {
    it("shows the saved link", () => {
        setBusiness({ locationUrl: "https://maps.app.goo.gl/AbC123xyz" });
        renderPage();
        const link = screen.getByRole("link", { name: "https://maps.app.goo.gl/AbC123xyz" }) as HTMLAnchorElement;
        expect(link.target).toBe("_blank");
        expect(link.rel).toContain("noopener");
    });

    it("shows a dash without a link", () => {
        setBusiness({ locationUrl: null });
        renderPage();
        expect(valueOf("Google Maps link")).toBe("—");
    });
});

describe("guest menu link", () => {
    it("uses the same URL as the QR page (configured base URL)", () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "http://localhost:5175");
        renderPage();
        const link = screen.getByRole("link", { name: "http://localhost:5175/biz-1/menu" }) as HTMLAnchorElement;
        expect(link.href).toBe(publicMenuUrl("biz-1"));
        expect(link.target).toBe("_blank");
    });

    it("keeps the existing default when no base URL is configured (no new domain)", () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "");
        renderPage();
        expect(screen.getByRole("link", { name: publicMenuUrl("biz-1")! })).toBeTruthy();
        expect(publicMenuUrl("biz-1")).toBe("https://agafari-menu.onrender.com/biz-1/menu");
    });

    // AGF-S2-20: an invalid configured address fails closed (no link, no copy)
    it("shows 'Guest menu link unavailable' when the configured address is invalid", () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "javascript:alert(1)");
        renderPage();
        expect(screen.getByText("Guest menu link unavailable")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
        expect(document.querySelector('a[href^="javascript"]')).toBeNull();
    });

    // AGF-S2-21 (D-S2-21-4): Copy link copies the share page (restaurant preview in chat apps); the visible link stays
    it("copies the share link, keeps showing the guest menu link, and confirms", async () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "http://localhost:5175");
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
        renderPage();

        expect(screen.getByRole("link", { name: "http://localhost:5175/biz-1/menu" })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

        await waitFor(() => expect(writeText).toHaveBeenCalledWith(shareUrl("biz-1")));
        expect(shareUrl("biz-1")).toMatch(/\/venue\/biz-1\/share$/);
        expect(await screen.findByText("Guest menu link copied")).toBeTruthy();
    });

    it("explains when copying fails or the browser has no clipboard", async () => {
        vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
        expect(await screen.findByText("Couldn't copy the link. Select it and copy it manually.")).toBeTruthy();
        cleanup();

        vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
        expect(await screen.findByText("Couldn't copy the link. Select it and copy it manually.")).toBeTruthy();
    });
});

// AGF-S2-12 CR1: the account page shows the country; Ethiopian restaurants have no address rows
describe("country on the account page", () => {
    it("Ethiopia (also when no country is stored): country row, no address rows", () => {
        setBusiness({ streetAddress: "Old Road 1", city: "Addis Ababa", state: "Addis Ababa" });
        renderPage();
        expect(valueOf("Country")).toBe("Ethiopia");
        for (const label of ["Address", "City", "Region", "State", "ZIP Code"]) expect(screen.queryByText(label)).toBeNull();
    });

    it("United States: country, address, city, state and ZIP rows", () => {
        setBusiness({ country: "US", streetAddress: "350 5th Ave", city: "New York", state: "NY", zipcode: "10118" });
        renderPage();
        expect(valueOf("Country")).toBe("United States");
        expect(valueOf("Address")).toBe("350 5th Ave");
        expect(valueOf("State")).toBe("NY");
        expect(valueOf("ZIP Code")).toBe("10118");
    });
});
