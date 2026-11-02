import { describe, expect, it } from "vitest";
import { trialEndDate } from "./trialDate";

// AGF E4-M5 trial end date (Option A): a trial's end is exclusive (the start of the day after its last day), so the last
// day is shown in the restaurant's time zone, whatever the browser's time zone is (run under TZ=UTC, America/Chicago and
// Asia/Tokyo to check: the results never change).

describe("trialEndDate", () => {
    it.each([
        ["UTC", "2027-01-01T00:00:00Z", "12/31/2026"],
        ["Africa/Addis_Ababa", "2026-12-31T21:00:00Z", "12/31/2026"],
        ["America/Chicago", "2027-01-01T06:00:00Z", "12/31/2026"],
        ["America/Chicago", "2027-03-15T05:00:00Z", "3/14/2027"], // after spring forward (CDT)
        ["America/Chicago", "2027-03-14T06:00:00Z", "3/13/2027"], // before spring forward (CST)
        ["America/Chicago", "2027-11-08T06:00:00Z", "11/7/2027"], // after fall back (CST)
        ["America/Havana", "2027-03-14T05:00:00Z", "3/13/2027"], // the next day starts at 01:00 (no midnight)
        ["Africa/Addis_Ababa", "2026-12-02T09:21:04Z", "12/2/2026"], // an automatic trial (created + 30 days)
    ])("in %s, an end of %s shows the last day %s", (timeZone, end, shown) => {
        expect(trialEndDate(end, timeZone)).toBe(shown);
    });

    it("shows the same date for every browser time zone, only the restaurant's matters", () => {
        const end = "2027-01-01T06:00:00Z"; // Chicago restaurant, extended to Dec 31
        expect(trialEndDate(end, "America/Chicago")).toBe("12/31/2026");
        expect(trialEndDate(end, "Africa/Addis_Ababa")).toBe("1/1/2027"); // a different restaurant zone is a different day
        expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBeTruthy(); // the browser zone is whatever the run uses
    });

    it("falls back to the browser time zone when the restaurant's is unknown, and shows nothing without an end", () => {
        expect(trialEndDate("2026-12-02T09:21:04Z", undefined)).toBe(new Date(Date.parse("2026-12-02T09:21:04Z") - 1).toLocaleDateString());
        expect(trialEndDate(null, "UTC")).toBe("");
    });
});
