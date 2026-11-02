// AGF E4-M5 trial end date (Option A): a trial's stored end is exclusive (the start of the day after its last day, in the
// restaurant's time zone), so the date shown is the last day of the trial, in the restaurant's time zone (from the
// backend), never the browser's. Falls back to the browser's zone only if the backend sent none.
export function trialEndDate(end: string | null | undefined, timeZone: string | null | undefined): string {
    if (!end) return '';
    const lastMoment = new Date(Date.parse(end) - 1);
    return new Intl.DateTimeFormat(undefined, { timeZone: timeZone || undefined, year: 'numeric', month: 'numeric', day: 'numeric' }).format(lastMoment);
}
