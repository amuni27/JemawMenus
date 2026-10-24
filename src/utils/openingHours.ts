// Guest "open now" status from the restaurant's weekly hours (AGF-S2-03).
// Evaluated in the restaurant's time zone, not the guest's: PO decision D3 fixes it to Africa/Addis_Ababa for now.

export const DEFAULT_TIME_ZONE = "Africa/Addis_Ababa";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_MIN = 24 * 60;
const WEEK_MIN = 7 * DAY_MIN;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)/;

export type DayHours = {
    dayOfWeek: string;
    isOpen: boolean;
    startTime?: string | null;
    endTime?: string | null;
};

export type OpeningInput = {
    open24_7?: boolean;
    hours?: DayHours[] | null;
    timeZone?: string | null;
};

export type OpeningInfo = {
    status: "open" | "closed" | "unknown";
    /** e.g. "Open now · until 22:00"; empty when unknown */
    label: string;
    /** e.g. "Today 08:00–22:00" or "Today: closed"; null when unknown or 24/7 */
    today: string | null;
};

type Interval = { day: number; start: number; end: number }; // minutes of the week; end may pass the week's end

function minutes(time?: string | null): number | null {
    const m = HHMM.exec(time ?? "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function clock(minuteOfDay: number): string {
    const m = ((minuteOfDay % DAY_MIN) + DAY_MIN) % DAY_MIN;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Day of the week (0 = Monday) and minute of the day at `now` in `timeZone`. */
function localTime(now: Date, timeZone?: string | null): { day: number; minute: number } {
    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = formatter(timeZone || DEFAULT_TIME_ZONE).formatToParts(now);
    } catch {
        parts = formatter(DEFAULT_TIME_ZONE).formatToParts(now);
    }
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const day = DAY_NAMES.indexOf(get("weekday"));
    return { day, minute: (Number(get("hour")) % 24) * 60 + Number(get("minute")) };
}

function formatter(timeZone: string) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
}

function intervals(hours: DayHours[]): Interval[] {
    const result: Interval[] = [];
    for (const h of hours) {
        const day = DAYS.indexOf(String(h.dayOfWeek).toUpperCase());
        const start = minutes(h.startTime);
        const end = minutes(h.endTime);
        if (day < 0 || !h.isOpen || start === null || end === null) continue;
        // end <= start: open past midnight (older data; the backend now requires start < end)
        const length = end > start ? end - start : end + DAY_MIN - start;
        result.push({ day, start: day * DAY_MIN + start, end: day * DAY_MIN + start + length });
    }
    return result;
}

/** "until midnight" reads better than "until 23:59" */
function closingTime(endMinuteOfWeek: number): string {
    const t = clock(endMinuteOfWeek);
    return t === "23:59" || t === "00:00" ? "midnight" : t;
}

export function openingStatus(business: OpeningInput, now: Date): OpeningInfo {
    if (business.open24_7) return { status: "open", label: "Open 24 hours", today: null };

    const hours = business.hours ?? [];
    const slots = intervals(hours);
    const closedDays = hours.filter((h) => !h.isOpen && DAYS.includes(String(h.dayOfWeek).toUpperCase()));
    if (slots.length === 0 && closedDays.length === 0) return { status: "unknown", label: "", today: null };

    const { day, minute } = localTime(now, business.timeZone);
    const m = day * DAY_MIN + minute;

    const todaySlot = slots.find((s) => s.day === day);
    const today = todaySlot ? `Today ${clock(todaySlot.start)}–${clock(todaySlot.end)}` : "Today: closed";

    const current = slots.find((s) => (s.start <= m && m < s.end) || (s.start <= m + WEEK_MIN && m + WEEK_MIN < s.end));
    if (current) return { status: "open", label: `Open now · until ${closingTime(current.end)}`, today };

    const prefix = todaySlot ? "Closed" : "Closed today";
    if (slots.length === 0) return { status: "closed", label: "Closed", today };

    // Next opening: the nearest start after now, wrapping around the week
    const next = slots
        .map((s) => ({ s, wait: (((s.start - m) % WEEK_MIN) + WEEK_MIN) % WEEK_MIN || WEEK_MIN }))
        .sort((a, b) => a.wait - b.wait)[0];
    const daysAhead = (next.s.day - day + 7) % 7;
    const when = daysAhead === 0 && next.wait < DAY_MIN ? ""
        : daysAhead === 1 ? "tomorrow "
        : `${DAY_NAMES[next.s.day]} `;
    return { status: "closed", label: `${prefix} · opens ${when}${clock(next.s.start)}`, today };
}
