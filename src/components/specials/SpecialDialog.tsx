import { useEffect, useMemo, useState } from "react";
import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import Button from "../ui/Button";
import { useFieldErrors } from "../../utils/fieldErrors";
import { formatPrice } from "../../utils/currency";
import { WEEK_DAYS, type DishOption, type Special, type SpecialPayload } from "../../types/special";

// AGF-S2-25 (checkpoint A): create or edit a special (D-S2-25-1, -4, -8, -9). The backend re-checks every rule.

type Props = {
    open: boolean;
    onClose: () => void;
    dishes: DishOption[];
    special?: Special;
    currency?: string;
    onSave: (payload: SpecialPayload) => Promise<void>;
};

type Draft = {
    menuItemId: string;
    specialPrice: string;
    note: string;
    noteAm: string;
    startsOn: string;
    endsOn: string;
    days: string[];
    startTime: string;
    endTime: string;
};

const DAY_LABELS: Record<string, string> = {
    MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

function draftOf(s?: Special): Draft {
    return {
        menuItemId: s?.menuItemId ?? "",
        specialPrice: s?.specialPrice != null ? String(s.specialPrice) : "",
        note: s?.note ?? "",
        noteAm: s?.noteAm ?? "",
        startsOn: s?.startsOn ?? "",
        endsOn: s?.endsOn ?? "",
        days: s?.daysOfWeek ?? [],
        startTime: s?.startTime ?? "",
        endTime: s?.endTime ?? "",
    };
}

const inWeekOrder = (days: string[]) => WEEK_DAYS.filter((d) => days.includes(d));

export default function SpecialDialog({ open, onClose, dishes, special, currency, onSave }: Props) {
    const [draft, setDraft] = useState<Draft>(() => draftOf(special));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const serverErrors = useFieldErrors();
    const clearServerErrors = serverErrors.clear;

    useEffect(() => {
        if (!open) return;
        setDraft(draftOf(special));
        setErrors({});
        clearServerErrors();
    }, [open, special, clearServerErrors]);

    const groups = useMemo(() => {
        const byMenu = new Map<string, { name: string; dishes: DishOption[] }>();
        for (const d of dishes) {
            if (!byMenu.has(d.menuId)) byMenu.set(d.menuId, { name: d.menuName, dishes: [] });
            byMenu.get(d.menuId)!.dishes.push(d);
        }
        return [...byMenu.values()];
    }, [dishes]);

    const dish = dishes.find((d) => d.id === draft.menuItemId);
    const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
    const toggleDay = (day: string) => set("days", draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day]);

    function validate(): Record<string, string> {
        const e: Record<string, string> = {};
        if (!draft.menuItemId) e.menuItemId = "Choose a dish.";
        const price = Number(draft.specialPrice);
        if (draft.specialPrice.trim() === "" || Number.isNaN(price)) e.specialPrice = "Enter the special price.";
        else if (price < 0) e.specialPrice = "The special price can't be negative.";
        else if (dish && price >= dish.price) e.specialPrice = `The special price must be lower than the regular price (${formatPrice(dish.price, currency)}).`;
        if (draft.startsOn && draft.endsOn && draft.endsOn < draft.startsOn) e.endsOn = "The end date can't be before the start date.";
        if (draft.startTime && !draft.endTime) e.endTime = "Add an end time too.";
        else if (!draft.startTime && draft.endTime) e.startTime = "Add a start time too.";
        else if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime) e.endTime = "The end time must be after the start time.";
        return e;
    }

    function payload(): SpecialPayload {
        const next = { ...draft, note: draft.note.trim(), noteAm: draft.noteAm.trim(), days: inWeekOrder(draft.days) };
        const p: SpecialPayload = {};
        if (!special) {
            p.menuItemId = next.menuItemId;
            p.specialPrice = Number(next.specialPrice);
            if (next.note) p.note = next.note;
            if (next.noteAm) p.noteAm = next.noteAm;
            if (next.startsOn) p.startsOn = next.startsOn;
            if (next.endsOn) p.endsOn = next.endsOn;
            if (next.days.length) p.daysOfWeek = next.days;
            if (next.startTime && next.endTime) { p.startTime = next.startTime; p.endTime = next.endTime; }
            return p;
        }
        const was = draftOf(special);
        if (next.menuItemId !== was.menuItemId) p.menuItemId = next.menuItemId;
        if (Number(next.specialPrice) !== Number(was.specialPrice)) p.specialPrice = Number(next.specialPrice);
        if (next.note !== was.note) p.note = next.note;
        if (next.noteAm !== was.noteAm) p.noteAm = next.noteAm;
        if (next.startsOn !== was.startsOn) { if (next.startsOn) p.startsOn = next.startsOn; else p.clearStartsOn = true; }
        if (next.endsOn !== was.endsOn) { if (next.endsOn) p.endsOn = next.endsOn; else p.clearEndsOn = true; }
        if (next.days.join() !== inWeekOrder(was.days).join()) p.daysOfWeek = next.days;
        if (next.startTime !== was.startTime || next.endTime !== was.endTime) {
            if (next.startTime && next.endTime) { p.startTime = next.startTime; p.endTime = next.endTime; } else p.clearTimeWindow = true;
        }
        return p;
    }

    const save = async () => {
        const e = validate();
        setErrors(e);
        if (Object.keys(e).length > 0) return;
        setSaving(true);
        try {
            await onSave(payload());
            onClose();
        } catch (err) {
            serverErrors.apply(err, {
                menuItemId: draft.menuItemId, specialPrice: draft.specialPrice, note: draft.note.trim(), noteAm: draft.noteAm.trim(),
                startsOn: draft.startsOn, endsOn: draft.endsOn, daysOfWeek: draft.days, startTime: draft.startTime, endTime: draft.endTime,
            }, "Couldn't save the special");
        } finally {
            setSaving(false);
        }
    };

    const error = (field: string, value: unknown) => errors[field] || serverErrors.errorFor(field, value);
    const Err = ({ field, value }: { field: string; value: unknown }) => {
        const message = error(field, value);
        return message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null;
    };

    return (
        <Modal open={open} onClose={onClose}>
            <ModalHeader title={special ? "Edit special" : "Add special"} onClose={onClose} />
            <div className="space-y-4">
                <div>
                    <label htmlFor="special-dish" className="mb-1 block text-sm font-medium text-gray-700">Dish</label>
                    <select id="special-dish" className={inputClass} value={draft.menuItemId} onChange={(e) => set("menuItemId", e.target.value)}>
                        <option value="">Choose a dish</option>
                        {groups.map((g) => (
                            <optgroup key={g.name} label={g.name}>
                                {g.dishes.map((d) => <option key={d.id} value={d.id}>{`${d.name} · ${formatPrice(d.price, currency)}`}</option>)}
                            </optgroup>
                        ))}
                    </select>
                    <Err field="menuItemId" value={draft.menuItemId} />
                </div>

                <div>
                    <label htmlFor="special-price" className="mb-1 block text-sm font-medium text-gray-700">Special price ({currency ?? "ETB"})</label>
                    <input id="special-price" className={inputClass} inputMode="decimal" value={draft.specialPrice} onChange={(e) => set("specialPrice", e.target.value)} />
                    {dish && <p className="mt-1 text-xs text-gray-500">Regular price: {formatPrice(dish.price, currency)}</p>}
                    <Err field="specialPrice" value={draft.specialPrice} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label htmlFor="special-note" className="mb-1 block text-sm font-medium text-gray-700">Note (optional)</label>
                        <input id="special-note" className={inputClass} maxLength={255} placeholder="e.g. Happy hour" value={draft.note} onChange={(e) => set("note", e.target.value)} />
                        <Err field="note" value={draft.note.trim()} />
                    </div>
                    <div>
                        <label htmlFor="special-note-am" className="mb-1 block text-sm font-medium text-gray-700">Note in Amharic (optional)</label>
                        <input id="special-note-am" lang="am" className={inputClass} maxLength={255} value={draft.noteAm} onChange={(e) => set("noteAm", e.target.value)} />
                        <Err field="noteAm" value={draft.noteAm.trim()} />
                    </div>
                </div>

                <fieldset className="space-y-3 rounded-xl border border-gray-200 p-4">
                    <legend className="px-1 text-sm font-medium text-gray-700">When (restaurant time)</legend>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label htmlFor="special-starts" className="mb-1 block text-xs font-medium text-gray-600">Start date (optional)</label>
                            <input id="special-starts" type="date" className={inputClass} value={draft.startsOn} onChange={(e) => set("startsOn", e.target.value)} />
                            <Err field="startsOn" value={draft.startsOn} />
                        </div>
                        <div>
                            <label htmlFor="special-ends" className="mb-1 block text-xs font-medium text-gray-600">End date (optional)</label>
                            <input id="special-ends" type="date" className={inputClass} value={draft.endsOn} onChange={(e) => set("endsOn", e.target.value)} />
                            <Err field="endsOn" value={draft.endsOn} />
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
                        <Err field="daysOfWeek" value={draft.days} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="special-from" className="mb-1 block text-xs font-medium text-gray-600">From</label>
                            <input id="special-from" type="time" className={inputClass} value={draft.startTime} onChange={(e) => set("startTime", e.target.value)} />
                            <Err field="startTime" value={draft.startTime} />
                        </div>
                        <div>
                            <label htmlFor="special-until" className="mb-1 block text-xs font-medium text-gray-600">Until</label>
                            <input id="special-until" type="time" className={inputClass} value={draft.endTime} onChange={(e) => set("endTime", e.target.value)} />
                            <Err field="endTime" value={draft.endTime} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">Leave the times empty for all day. A time window can't run past midnight.</p>
                </fieldset>

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={save} isLoading={saving}>{special ? "Save special" : "Add special"}</Button>
                </div>
            </div>
        </Modal>
    );
}
