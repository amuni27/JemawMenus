import { describe, expect, it } from "vitest";
import { openingStatus, type DayHours } from "./openingHours";

// AGF-S2-03: "open now" is evaluated in the restaurant's time zone (D3: Africa/Addis_Ababa, UTC+3, no DST).
// 2026-10-21 is a Wednesday. Addis local time = UTC + 3 h.
const at = (localIso: string) => new Date(new Date(localIso + "Z").getTime() - 3 * 3600_000);

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
function week(spec: Record<string, [string, string] | null>): DayHours[] {
    return DAYS.map((d) => spec[d] === undefined || spec[d] === null
        ? { dayOfWeek: d, isOpen: false, startTime: null, endTime: null }
        : { dayOfWeek: d, isOpen: true, startTime: spec[d]![0], endTime: spec[d]![1] });
}
const weekdays = week({
    MONDAY: ["08:00", "22:00"], TUESDAY: ["08:00", "22:00"], WEDNESDAY: ["08:00", "22:00"],
    THURSDAY: ["08:00", "22:00"], FRIDAY: ["08:00", "22:00"], SATURDAY: ["10:00", "23:59"], SUNDAY: null,
});
const biz = (hours: DayHours[] | null, extra = {}) => ({ open24_7: false, hours, timeZone: "Africa/Addis_Ababa", ...extra });

describe("openingStatus", () => {
    it("is open with the closing time during opening hours (AC1: 21:00, open 08:00–22:00)", () => {
        expect(openingStatus(biz(weekdays), at("2026-10-21T21:00:00"))).toEqual({
            status: "open", label: "Open now · until 22:00", today: "Today 08:00–22:00",
        });
    });

    it("is open at opening time and closed exactly at closing time", () => {
        expect(openingStatus(biz(weekdays), at("2026-10-21T08:00:00")).status).toBe("open");
        expect(openingStatus(biz(weekdays), at("2026-10-21T21:59:00")).status).toBe("open");
        expect(openingStatus(biz(weekdays), at("2026-10-21T22:00:00")).label).toBe("Closed · opens tomorrow 08:00");
    });

    it("shows today's opening time before opening", () => {
        expect(openingStatus(biz(weekdays), at("2026-10-21T07:30:00")).label).toBe("Closed · opens 08:00");
    });

    it("shows 'Closed today' with the next opening on a closed day (AC2)", () => {
        expect(openingStatus(biz(weekdays), at("2026-10-25T12:00:00"))).toEqual({
            status: "closed", label: "Closed today · opens tomorrow 08:00", today: "Today: closed",
        });
        const weekendClosed = week({ MONDAY: ["08:00", "22:00"], FRIDAY: ["08:00", "22:00"] });
        expect(openingStatus(biz(weekendClosed), at("2026-10-24T12:00:00")).label).toBe("Closed today · opens Monday 08:00");
    });

    it("uses the restaurant's date, not the UTC date, around midnight", () => {
        // 21:30 UTC on Saturday is already 00:30 on Sunday in Addis Ababa (closed day)
        const sundayInAddis = new Date("2026-10-24T21:30:00Z");
        expect(openingStatus(biz(weekdays), sundayInAddis).label).toBe("Closed today · opens tomorrow 08:00");
        // Saturday 23:58 local: still open, closing at midnight
        expect(openingStatus(biz(weekdays), at("2026-10-24T23:58:00")).label).toBe("Open now · until midnight");
        // Saturday 23:59 local: closed
        expect(openingStatus(biz(weekdays), at("2026-10-24T23:59:00")).status).toBe("closed");
    });

    it("handles hours that run past midnight (stored before validation existed)", () => {
        const late = week({ FRIDAY: ["18:00", "02:00"], SUNDAY: ["18:00", "02:00"] });
        expect(openingStatus(biz(late), at("2026-10-24T01:00:00")).label).toBe("Open now · until 02:00");
        expect(openingStatus(biz(late), at("2026-10-24T02:00:00")).label).toBe("Closed today · opens tomorrow 18:00");
        // Sunday night into Monday wraps around the week
        expect(openingStatus(biz(late), at("2026-10-26T01:30:00")).status).toBe("open");
    });

    it("finds the next opening a week later when today is the only open day", () => {
        const mondays = week({ MONDAY: ["08:00", "12:00"] });
        expect(openingStatus(biz(mondays), at("2026-10-26T13:00:00")).label).toBe("Closed · opens Monday 08:00");
    });

    it("shows 'Open 24 hours' for 24/7 businesses (AC3)", () => {
        expect(openingStatus(biz([], { open24_7: true }), at("2026-10-21T03:00:00"))).toEqual({
            status: "open", label: "Open 24 hours", today: null,
        });
    });

    it("says nothing when no usable hours are stored", () => {
        const unknown = { status: "unknown", label: "", today: null };
        expect(openingStatus(biz(null), at("2026-10-21T12:00:00"))).toEqual(unknown);
        expect(openingStatus(biz([]), at("2026-10-21T12:00:00"))).toEqual(unknown);
        const openWithoutTimes = DAYS.map((d) => ({ dayOfWeek: d, isOpen: true, startTime: null, endTime: null }));
        expect(openingStatus(biz(openWithoutTimes), at("2026-10-21T12:00:00"))).toEqual(unknown);
    });

    it("is 'Closed' without a next opening when every day is closed", () => {
        expect(openingStatus(biz(week({})), at("2026-10-21T12:00:00"))).toEqual({
            status: "closed", label: "Closed", today: "Today: closed",
        });
    });

    it("falls back to Africa/Addis_Ababa when the time zone is missing or invalid", () => {
        for (const timeZone of [undefined, null, "Not/AZone"]) {
            expect(openingStatus(biz(weekdays, { timeZone }), at("2026-10-21T21:00:00")).label).toBe("Open now · until 22:00");
        }
    });

    // AGF-S2-26: US restaurants are evaluated in their own zone, with daylight saving (AC3, AC4)
    it("follows a US restaurant's local clock in winter and summer", () => {
        const nineToFive = week({ MONDAY: ["09:00", "17:00"], TUESDAY: ["09:00", "17:00"], WEDNESDAY: ["09:00", "17:00"],
            THURSDAY: ["09:00", "17:00"], FRIDAY: ["09:00", "17:00"], SATURDAY: null, SUNDAY: null });
        const ny = biz(nineToFive, { timeZone: "America/New_York" });
        const phx = biz(nineToFive, { timeZone: "America/Phoenix" });
        // Wednesday 2026-01-14 15:00 UTC = 10:00 New York (EST) = 08:00 Phoenix
        expect(openingStatus(ny, new Date("2026-01-14T15:00:00Z")).status).toBe("open");
        expect(openingStatus(phx, new Date("2026-01-14T15:00:00Z")).status).toBe("closed");
        // Wednesday 2026-07-15 14:00 UTC = 10:00 New York (EDT) = 07:00 Phoenix (no DST)
        expect(openingStatus(ny, new Date("2026-07-15T14:00:00Z")).status).toBe("open");
        expect(openingStatus(phx, new Date("2026-07-15T14:00:00Z")).status).toBe("closed");
        // 22:00 UTC in July = 18:00 New York: closed; 15:00 Phoenix: open
        expect(openingStatus(ny, new Date("2026-07-15T22:00:00Z")).status).toBe("closed");
        expect(openingStatus(phx, new Date("2026-07-15T22:00:00Z")).status).toBe("open");
    });
});
