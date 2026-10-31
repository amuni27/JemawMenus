import { WEEK_DAYS } from "../../types/special";
import type { ScheduleDraft } from "../../utils/specialSchedule";

// AGF-S2-36: the "When (restaurant time)" controls shared by dish and category special dialogs (moved unchanged from
// the S2-25 dish dialog).

const DAY_LABELS: Record<string, string> = {
    MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

type Props = {
    idPrefix: string;
    draft: ScheduleDraft;
    onChange: (next: ScheduleDraft) => void;
    errorFor: (field: string, value: unknown) => string | undefined;
};

export default function ScheduleFields({ idPrefix, draft, onChange, errorFor }: Props) {
    const set = <K extends keyof ScheduleDraft>(key: K, value: ScheduleDraft[K]) => onChange({ ...draft, [key]: value });
    const toggleDay = (day: string) => set("days", draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day]);
    const err = (field: string, value: unknown) => {
        const message = errorFor(field, value);
        return message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null;
    };

    return (
        <fieldset className="space-y-3 rounded-xl border border-gray-200 p-4">
            <legend className="px-1 text-sm font-medium text-gray-700">When (restaurant time)</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                    <label htmlFor={`${idPrefix}-starts`} className="mb-1 block text-xs font-medium text-gray-600">Start date (optional)</label>
                    <input id={`${idPrefix}-starts`} type="date" className={inputClass} value={draft.startsOn} onChange={(e) => set("startsOn", e.target.value)} />
                    {err("startsOn", draft.startsOn)}
                </div>
                <div>
                    <label htmlFor={`${idPrefix}-ends`} className="mb-1 block text-xs font-medium text-gray-600">End date (optional)</label>
                    <input id={`${idPrefix}-ends`} type="date" className={inputClass} value={draft.endsOn} onChange={(e) => set("endsOn", e.target.value)} />
                    {err("endsOn", draft.endsOn)}
                </div>
            </div>

            <div>
                <p className="mb-1 text-xs font-medium text-gray-600">Days (none ticked = every day)</p>
                <div className="flex flex-wrap gap-2">
                    {WEEK_DAYS.map((day) => (
                        <label key={day} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs">
                            <input type="checkbox" checked={draft.days.includes(day)} onChange={() => toggleDay(day)} />
                            {DAY_LABELS[day]}
                        </label>
                    ))}
                </div>
                {err("daysOfWeek", draft.days)}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor={`${idPrefix}-from`} className="mb-1 block text-xs font-medium text-gray-600">From</label>
                    <input id={`${idPrefix}-from`} type="time" className={inputClass} value={draft.startTime} onChange={(e) => set("startTime", e.target.value)} />
                    {err("startTime", draft.startTime)}
                </div>
                <div>
                    <label htmlFor={`${idPrefix}-until`} className="mb-1 block text-xs font-medium text-gray-600">Until</label>
                    <input id={`${idPrefix}-until`} type="time" className={inputClass} value={draft.endTime} onChange={(e) => set("endTime", e.target.value)} />
                    {err("endTime", draft.endTime)}
                </div>
            </div>
            <p className="text-xs text-gray-500">Leave the times empty for all day. A time window can't run past midnight.</p>
        </fieldset>
    );
}
