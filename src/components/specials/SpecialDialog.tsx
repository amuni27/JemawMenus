import { useEffect, useMemo, useState } from "react";
import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import Button from "../ui/Button";
import ScheduleFields from "./ScheduleFields";
import { useFieldErrors } from "../../utils/fieldErrors";
import { formatPrice } from "../../utils/currency";
import { scheduleChangePayload, scheduleCreatePayload, scheduleDraftOf, scheduleErrors, type ScheduleDraft } from "../../utils/specialSchedule";
import type { DishOption, Special, SpecialPayload } from "../../types/special";

// AGF-S2-25 (checkpoint A): create or edit a special (D-S2-25-1, -4, -8, -9). The backend re-checks every rule.
// AGF-S2-36: the schedule controls are shared with category specials (ScheduleFields); behaviour unchanged.

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
    schedule: ScheduleDraft;
};

const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

function draftOf(s?: Special): Draft {
    return {
        menuItemId: s?.menuItemId ?? "",
        specialPrice: s?.specialPrice != null ? String(s.specialPrice) : "",
        note: s?.note ?? "",
        noteAm: s?.noteAm ?? "",
        schedule: scheduleDraftOf(s),
    };
}

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

    function validate(): Record<string, string> {
        const e: Record<string, string> = {};
        if (!draft.menuItemId) e.menuItemId = "Choose a dish.";
        const price = Number(draft.specialPrice);
        if (draft.specialPrice.trim() === "" || Number.isNaN(price)) e.specialPrice = "Enter the special price.";
        else if (price < 0) e.specialPrice = "The special price can't be negative.";
        else if (dish && price >= dish.price) e.specialPrice = `The special price must be lower than the regular price (${formatPrice(dish.price, currency)}).`;
        return { ...e, ...scheduleErrors(draft.schedule) };
    }

    function payload(): SpecialPayload {
        const note = draft.note.trim();
        const noteAm = draft.noteAm.trim();
        if (!special) {
            const p: SpecialPayload = { menuItemId: draft.menuItemId, specialPrice: Number(draft.specialPrice) };
            if (note) p.note = note;
            if (noteAm) p.noteAm = noteAm;
            return { ...p, ...scheduleCreatePayload(draft.schedule) };
        }
        const was = draftOf(special);
        const p: SpecialPayload = {};
        if (draft.menuItemId !== was.menuItemId) p.menuItemId = draft.menuItemId;
        if (Number(draft.specialPrice) !== Number(was.specialPrice)) p.specialPrice = Number(draft.specialPrice);
        if (note !== was.note) p.note = note;
        if (noteAm !== was.noteAm) p.noteAm = noteAm;
        return { ...p, ...scheduleChangePayload(draft.schedule, was.schedule) };
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
            const s = draft.schedule;
            serverErrors.apply(err, {
                menuItemId: draft.menuItemId, specialPrice: draft.specialPrice, note: draft.note.trim(), noteAm: draft.noteAm.trim(),
                startsOn: s.startsOn, endsOn: s.endsOn, daysOfWeek: s.days, startTime: s.startTime, endTime: s.endTime,
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

                <ScheduleFields idPrefix="special" draft={draft.schedule} onChange={(schedule) => set("schedule", schedule)} errorFor={error} />

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={save} isLoading={saving}>{special ? "Save special" : "Add special"}</Button>
                </div>
            </div>
        </Modal>
    );
}
