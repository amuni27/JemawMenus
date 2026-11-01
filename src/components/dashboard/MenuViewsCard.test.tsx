// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

// AGF-S2-24: the owner's "Menu views" card: today, last 7 and last 30 days, a 14-day bar strip with a text
// alternative, an honest label (openings incl. reloads, not unique visitors), and empty and error states.

const get = vi.fn();
vi.mock("../../api/menuViewsApi", () => ({ default: { get } }));

const { default: MenuViewsCard } = await import("./MenuViewsCard.tsx");

/** 30 consecutive days ending 2026-11-02; views[i] belongs to day i (oldest first). */
function series(views: number[]) {
    const end = new Date("2026-11-02T00:00:00Z");
    return views.map((v, i) => {
        const d = new Date(end);
        d.setUTCDate(end.getUTCDate() - (views.length - 1 - i));
        return { date: d.toISOString().slice(0, 10), views: v };
    });
}

beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: { timeZone: "Africa/Addis_Ababa", today: 0, days: [] } });
});
afterEach(() => cleanup());

describe("menu views card", () => {
    it("asks for the owner's own restaurant, 30 days", async () => {
        get.mockResolvedValue({ data: { timeZone: "Africa/Addis_Ababa", today: 0, days: series(Array(30).fill(0)) } });
        render(<MenuViewsCard businessId="biz-1" />);
        await screen.findByRole("heading", { name: "Menu views" });
        expect(get).toHaveBeenCalledWith("biz-1", 30);
    });

    it("shows today, the last 7 days and the last 30 days", async () => {
        const views = Array(30).fill(1);  // 30 in total
        views[29] = 5;                    // today
        views[25] = 10;                   // inside the last 7 days
        views[10] = 100;                  // only inside the 30 days
        get.mockResolvedValue({ data: { timeZone: "Africa/Addis_Ababa", today: 5, days: series(views) } });
        render(<MenuViewsCard businessId="biz-1" />);

        expect(await screen.findByTestId("views-today")).toHaveProperty("textContent", "5");
        expect(screen.getByTestId("views-7")).toHaveProperty("textContent", String(5 + 10 + 5 * 1));
        expect(screen.getByTestId("views-30")).toHaveProperty("textContent", String(5 + 10 + 100 + 27 * 1));
        expect(screen.getByText(/including reloads/i).textContent).toMatch(/not unique visitors/i);
    });

    it("has a 14-day strip with a text alternative for every day", async () => {
        const views = Array(30).fill(0);
        views[29] = 3;
        views[16] = 7; // 14th day from the end (2026-10-20) is the strip's first day
        views[15] = 9; // day 15 from the end: not in the strip
        get.mockResolvedValue({ data: { timeZone: "Africa/Addis_Ababa", today: 3, days: series(views) } });
        render(<MenuViewsCard businessId="biz-1" />);

        const list = await screen.findByRole("list", { name: /daily views, last 14 days/i });
        const days = within(list).getAllByRole("listitem");
        expect(days).toHaveLength(14);
        expect(days[0].textContent).toMatch(/2026-10-20.*7 views/);
        expect(days[13].textContent).toMatch(/2026-11-02.*3 views/);
        expect(list.textContent).not.toMatch(/9 views/);
    });

    it("explains how to start when there are no views yet", async () => {
        get.mockResolvedValue({ data: { timeZone: "Africa/Addis_Ababa", today: 0, days: series(Array(30).fill(0)) } });
        render(<MenuViewsCard businessId="biz-1" />);
        expect(await screen.findByText("No views yet. Share your QR code to start.")).toBeTruthy();
    });

    it("shows 'Views unavailable' when the views can't be loaded", async () => {
        get.mockRejectedValue(new Error("boom"));
        render(<MenuViewsCard businessId="biz-1" />);
        expect(await screen.findByText("Views unavailable")).toBeTruthy();
        expect(screen.queryByTestId("views-today")).toBeNull();
    });
});
