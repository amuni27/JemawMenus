import { useEffect, useMemo, useState } from "react";
import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import Button from "../ui/Button";
import ScheduleFields from "./ScheduleFields";
import { useFieldErrors } from "../../utils/fieldErrors";
import { scheduleChangePayload, scheduleCreatePayload, scheduleDraftOf, scheduleErrors, type ScheduleDraft } from "../../utils/specialSchedule";
import type { CategoryOption, CategorySpecial, CategorySpecialPayload } from "../../types/special";

// AGF-S2-36 (checkpoint A): create or edit a category special (D-CS-3, -4, -5): a whole-number percentage off every
// eligible dish of one category, with the same schedule controls as dish specials. The backend re-checks every rule.

type Props = {
    open: boolean;
    onClose: () => void;
    categories: CategoryOption[];
    special?: CategorySpecial;
    onSave: (payload: CategorySpecialPayload) => Promise<void>;
};

type Draft = { categoryId: string; percent: string; note: string; noteAm: string; schedule: ScheduleDraft };

const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
const PERCENT_MESSAGE = "Use a whole number from 1 to 90.";

function draftOf(s?: CategorySpecial): Draft {
    return {
        categoryId: s?.categoryId ?? "",
        percent: s?.discountPercent != null ? String(s.discountPercent) : "",
        note: s?.note ?? "",
        noteAm: s?.noteAm ?? "",
        schedule: scheduleDraftOf(s),
    };
}

export default function CategorySpecialDialog({ open, onClose, categories, special, onSave }: Props) {
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
        const byMenu = new Map<string, { name: string; categories: CategoryOption[] }>();
        for (const c of categories) {
            if (!byMenu.has(c.menuId)) byMenu.set(c.menuId, { name: c.menuName, categories: [] });
            byMenu.get(c.menuId)!.categories.push(c);
        }
        return [...byMenu.values()];
    }, [categories]);

    const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

    function validate(): Record<string, string> {
        const e: Record<string, string> = {};
        if (!draft.categoryId) e.categoryId = "Choose a category.";
        const raw = draft.percent.trim();
        if (raw === "") e.discountPercent = "Enter the discount percentage.";
        else if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 90) e.discountPercent = PERCENT_MESSAGE;
        return { ...e, ...scheduleErrors(draft.schedule) };
    }

    function payload(): CategorySpecialPayload {
        const note = draft.note.trim();
        const noteAm = draft.noteAm.trim();
        if (!special) {
            const p: CategorySpecialPayload = { categoryId: draft.categoryId, discountPercent: Number(draft.percent) };
            if (note) p.note = note;
            if (noteAm) p.noteAm = noteAm;
            return { ...p, ...scheduleCreatePayload(draft.schedule) };
        }
        const was = draftOf(special);
        const p: CategorySpecialPayload = {};
        if (draft.categoryId !== was.categoryId) p.categoryId = draft.categoryId;
        if (Number(draft.percent) !== Number(was.percent)) p.discountPercent = Number(draft.percent);
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
                categoryId: draft.categoryId, discountPercent: draft.percent, note: draft.note.trim(), noteAm: draft.noteAm.trim(),
                startsOn: s.startsOn, endsOn: s.endsOn, daysOfWeek: s.days, startTime: s.startTime, endTime: s.endTime,
            }, "Couldn't save the category special");
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
            <ModalHeader title={special ? "Edit category special" : "Add category special"} onClose={onClose} />
            <div className="space-y-4">
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    A percentage off every dish guests can see in the category. Dishes with their own special keep it.
                </p>
                <div>
                    <label htmlFor="category-special-category" className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                    <select id="category-special-category" className={inputClass} value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                        <option value="">Choose a category</option>
                        {groups.map((g) => (
                            <optgroup key={g.name} label={g.name}>
                                {g.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </optgroup>
                        ))}
                    </select>
                    <Err field="categoryId" value={draft.categoryId} />
                </div>

                <div>
                    <label htmlFor="category-special-percent" className="mb-1 block text-sm font-medium text-gray-700">Discount (%)</label>
                    <input id="category-special-percent" className={inputClass} inputMode="numeric" value={draft.percent} onChange={(e) => set("percent", e.target.value)} />
                    <Err field="discountPercent" value={draft.percent} />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label htmlFor="category-special-note" className="mb-1 block text-sm font-medium text-gray-700">Note (optional)</label>
                        <input id="category-special-note" className={inputClass} maxLength={255} placeholder="e.g. Sweet hour" value={draft.note} onChange={(e) => set("note", e.target.value)} />
                        <Err field="note" value={draft.note.trim()} />
                    </div>
                    <div>
                        <label htmlFor="category-special-note-am" className="mb-1 block text-sm font-medium text-gray-700">Note in Amharic (optional)</label>
                        <input id="category-special-note-am" lang="am" className={inputClass} maxLength={255} value={draft.noteAm} onChange={(e) => set("noteAm", e.target.value)} />
                        <Err field="noteAm" value={draft.noteAm.trim()} />
                    </div>
                </div>

                <ScheduleFields idPrefix="category-special" draft={draft.schedule} onChange={(schedule) => set("schedule", schedule)} errorFor={error} />

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={save} isLoading={saving}>{special ? "Save category special" : "Add category special"}</Button>
                </div>
            </div>
        </Modal>
    );
}
