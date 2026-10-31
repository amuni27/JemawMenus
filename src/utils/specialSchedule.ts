// AGF-S2-36: the schedule part shared by dish (S2-25) and category special dialogs: optional dates, weekdays and one
// daily window in the restaurant's time. Same rules and messages as the backend (ScheduleRules).
import { WEEK_DAYS } from "../types/special";

export type ScheduleDraft = { startsOn: string; endsOn: string; days: string[]; startTime: string; endTime: string };

type ScheduleSource = { startsOn?: string | null; endsOn?: string | null; daysOfWeek?: string[] | null; startTime?: string | null; endTime?: string | null };

export type SchedulePayload = Partial<{
    startsOn: string; endsOn: string; daysOfWeek: string[]; startTime: string; endTime: string;
    clearStartsOn: boolean; clearEndsOn: boolean; clearTimeWindow: boolean;
}>;

export const inWeekOrder = (days: string[]) => WEEK_DAYS.filter((d) => days.includes(d));

export function scheduleDraftOf(s?: ScheduleSource): ScheduleDraft {
    return {
        startsOn: s?.startsOn ?? "",
        endsOn: s?.endsOn ?? "",
        days: s?.daysOfWeek ?? [],
        startTime: s?.startTime ?? "",
        endTime: s?.endTime ?? "",
    };
}

export function scheduleErrors(d: ScheduleDraft): Record<string, string> {
    const e: Record<string, string> = {};
    if (d.startsOn && d.endsOn && d.endsOn < d.startsOn) e.endsOn = "The end date can't be before the start date.";
    if (d.startTime && !d.endTime) e.endTime = "Add an end time too.";
    else if (!d.startTime && d.endTime) e.startTime = "Add a start time too.";
    else if (d.startTime && d.endTime && d.endTime <= d.startTime) e.endTime = "The end time must be after the start time.";
    return e;
}

/** New special: only the filled fields. */
export function scheduleCreatePayload(d: ScheduleDraft): SchedulePayload {
    const p: SchedulePayload = {};
    const days = inWeekOrder(d.days);
    if (d.startsOn) p.startsOn = d.startsOn;
    if (d.endsOn) p.endsOn = d.endsOn;
    if (days.length) p.daysOfWeek = days;
    if (d.startTime && d.endTime) { p.startTime = d.startTime; p.endTime = d.endTime; }
    return p;
}

/** Edit: only what changed; emptied dates or window become clear flags. */
export function scheduleChangePayload(next: ScheduleDraft, was: ScheduleDraft): SchedulePayload {
    const p: SchedulePayload = {};
    if (next.startsOn !== was.startsOn) { if (next.startsOn) p.startsOn = next.startsOn; else p.clearStartsOn = true; }
    if (next.endsOn !== was.endsOn) { if (next.endsOn) p.endsOn = next.endsOn; else p.clearEndsOn = true; }
    const days = inWeekOrder(next.days);
    if (days.join() !== inWeekOrder(was.days).join()) p.daysOfWeek = days;
    if (next.startTime !== was.startTime || next.endTime !== was.endTime) {
        if (next.startTime && next.endTime) { p.startTime = next.startTime; p.endTime = next.endTime; } else p.clearTimeWindow = true;
    }
    return p;
}
