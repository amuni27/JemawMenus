// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// AGF E4-M8 (AC9): the Super Admin's oversight of restaurant ads: every restaurant's ads with status and suspension reason;
// suspend needs a reason; reinstate returns the ad to Paused (the owner decides when it runs); no create, edit or archive.

const restaurantAds = vi.fn();
const suspendRestaurantAd = vi.fn();
const reinstateRestaurantAd = vi.fn();
vi.mock("../../api/adminApi", async (orig) => ({
    ...(await orig<typeof import("../../api/adminApi")>()),
    adminApi: { restaurantAds, suspendRestaurantAd, reinstateRestaurantAd },
}));

const { default: SuperAdminRestaurantAds } = await import("./SuperAdminRestaurantAds.tsx");

const ad = (over: Record<string, unknown> = {}) => ({
    id: "r1", businessId: "biz-1", businessName: "Abol Cafe", title: "Lunch deal", body: "Two courses", linkUrl: "https://example.test/lunch",
    startsAt: "2026-12-01T06:00:00Z", scheduleTimeZone: "Africa/Addis_Ababa", startLocal: "2026-12-01T09:00", startOffset: "+03:00", status: "ACTIVE",
    createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", rowVersion: 1, ...over,
});

beforeEach(() => {
    for (const fn of [restaurantAds, suspendRestaurantAd, reinstateRestaurantAd]) fn.mockReset();
    restaurantAds.mockResolvedValue({ data: [ad(), ad({ id: "r2", title: "Old promo", status: "SUSPENDED", suspensionReason: "Misleading price", rowVersion: 4 })] });
    suspendRestaurantAd.mockResolvedValue({ data: ad({ status: "SUSPENDED" }) });
    reinstateRestaurantAd.mockResolvedValue({ data: ad({ status: "PAUSED" }) });
});
afterEach(() => cleanup());

describe("Super Admin restaurant ads", () => {
    it("lists every restaurant's ads with status and suspension reason, without create, edit or archive", async () => {
        render(<SuperAdminRestaurantAds />);
        const t = await screen.findByRole("table", { name: "Restaurant ads" });
        expect(t.textContent).toContain("Abol Cafe");
        expect(t.textContent).toContain("Lunch deal");
        expect(t.textContent).toContain("Suspended");
        expect(t.textContent).toContain("Misleading price");
        expect(screen.queryByRole("button", { name: /New ad|^Edit |^Archive / })).toBeNull();
    });

    it("suspends only with a reason", async () => {
        render(<SuperAdminRestaurantAds />);
        await screen.findByRole("table", { name: "Restaurant ads" });
        fireEvent.click(screen.getByRole("button", { name: "Suspend Lunch deal" }));
        const dialog = screen.getByRole("dialog", { name: "Suspend ad" });
        const confirm = within(dialog).getByRole("button", { name: "Suspend" }) as HTMLButtonElement;
        expect(confirm.disabled).toBe(true);
        fireEvent.change(within(dialog).getByLabelText("Reason (shown to the restaurant)"), { target: { value: "Misleading price" } });
        expect(confirm.disabled).toBe(false);
        fireEvent.click(confirm);
        await waitFor(() => expect(suspendRestaurantAd).toHaveBeenCalledWith("r1", "Misleading price", 1));
    });

    it("reinstates a suspended ad to Paused and filters by status", async () => {
        render(<SuperAdminRestaurantAds />);
        await screen.findByRole("table", { name: "Restaurant ads" });
        fireEvent.click(screen.getByRole("button", { name: "Reinstate Old promo" }));
        await waitFor(() => expect(reinstateRestaurantAd).toHaveBeenCalledWith("r2", 4));
        expect(screen.getByText("Reinstated ads return to Paused; the restaurant decides when they run again.")).toBeTruthy();
        fireEvent.change(screen.getByLabelText("Status"), { target: { value: "SUSPENDED" } });
        await waitFor(() => expect(restaurantAds).toHaveBeenLastCalledWith({ status: "SUSPENDED" }));
    });
});
