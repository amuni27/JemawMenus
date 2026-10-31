import { useCallback, useEffect, useState } from "react";
import specialsApi from "../../api/specialsApi";
import menuApi from "../../api/menuApi";
import SpecialDialog from "../../components/specials/SpecialDialog";
import Modal from "../../components/ui/Modal";
import ModalHeader from "../../components/ui/ModalHeader";
import Button from "../../components/ui/Button";
import LoadError from "../../components/ui/LoadError";
import { useToast } from "../../components/ui/ToastContext";
import { formatPrice } from "../../utils/currency";
import { errorMessage } from "../../utils/errorMessage";
import type { DishOption, Special, SpecialPayload, SpecialStatus } from "../../types/special";

// AGF-S2-25 (checkpoint A, D-S2-25-7): the owner's specials. Free for every restaurant (G7/D7). Guests see specials
// in checkpoint B.

const STATUS: Record<SpecialStatus, { label: string; className: string }> = {
    ACTIVE: { label: "Active now", className: "bg-emerald-50 text-emerald-800" },
    SCHEDULED: { label: "Scheduled", className: "bg-blue-50 text-blue-800" },
    ENDED: { label: "Ended", className: "bg-gray-100 text-gray-700" },
    PAUSED: { label: "Paused", className: "bg-amber-50 text-amber-800" },
};

const DAY_SHORT: Record<string, string> = {
    MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

/** e.g. "Mon, Fri · 16:00–18:00" or "Every day · 2026-11-10 to 2026-11-30" */
function scheduleOf(s: Special): string {
    const days = s.daysOfWeek?.length ? s.daysOfWeek.map((d) => DAY_SHORT[d] ?? d).join(", ") : "Every day";
    const parts = [days];
    if (s.startTime && s.endTime) parts.push(`${s.startTime}–${s.endTime}`);
    if (s.startsOn && s.endsOn) parts.push(`${s.startsOn} to ${s.endsOn}`);
    else if (s.startsOn) parts.push(`from ${s.startsOn}`);
    else if (s.endsOn) parts.push(`until ${s.endsOn}`);
    return parts.join(" · ");
}

const listFrom = <T,>(res: unknown): T[] => {
    const data = (res as { data?: unknown })?.data ?? res;
    return Array.isArray(data) ? (data as T[]) : [];
};

export default function SpecialsPage() {
    const toast = useToast();
    const [specials, setSpecials] = useState<Special[] | null>(null);
    const [dishes, setDishes] = useState<DishOption[]>([]);
    const [currency, setCurrency] = useState<string | undefined>();
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const [editing, setEditing] = useState<Special | "new" | null>(null);
    const [deleting, setDeleting] = useState<Special | null>(null);

    const reload = useCallback(async () => {
        const list = listFrom<Special>(await specialsApi.list());
        setSpecials(list);
        if (list[0]?.currency) setCurrency(list[0].currency);
    }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                setError("");
                await reload();
                // dishes for the dialog: every menu's items (all scoped to the owner's restaurant by the backend)
                const menus = listFrom<{ id: string; name: string; currency?: string }>(await menuApi.listMenus());
                if (menus[0]?.currency) setCurrency((c) => c ?? menus[0].currency);
                const perMenu = await Promise.all(menus.map(async (m) =>
                    listFrom<{ id: string; name: string; price: number }>(await menuApi.listItems(m.id))
                        .map((i) => ({ id: i.id, name: i.name, price: Number(i.price), menuId: m.id, menuName: m.name }))));
                if (alive) setDishes(perMenu.flat());
            } catch (err) {
                if (alive) setError(errorMessage(err, "Couldn't load your specials. Please try again."));
            }
        })();
        return () => { alive = false; };
    }, [attempt, reload]);

    const save = async (payload: SpecialPayload) => {
        if (editing && editing !== "new") await specialsApi.update(editing.id, payload);
        else await specialsApi.create(payload);
        toast(editing && editing !== "new" ? "Special updated" : "Special added");
        await reload();
    };

    const setPaused = async (s: Special, paused: boolean) => {
        try {
            await specialsApi.update(s.id, { paused });
            toast(paused ? "Special paused" : "Special resumed");
            await reload();
        } catch (err) {
            toast(errorMessage(err, "Couldn't update the special"));
        }
    };

    const confirmDelete = async () => {
        if (!deleting) return;
        try {
            await specialsApi.remove(deleting.id);
            toast("Special deleted");
            setDeleting(null);
            await reload();
        } catch (err) {
            toast(errorMessage(err, "Couldn't delete the special"));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <nav className="mb-1 text-sm text-gray-500">Venue <span className="mx-1">/</span> Specials</nav>
                    <h2 className="text-2xl font-bold text-gray-900">Specials</h2>
                    <p className="mt-1 text-sm text-gray-600">Offer a dish at a lower price for a time. Times use your restaurant's time zone.</p>
                </div>
                <Button onClick={() => setEditing("new")}>Add special</Button>
            </div>

            {error ? (
                <LoadError message={error} onRetry={() => { setSpecials(null); setAttempt((n) => n + 1); }} />
            ) : specials === null ? (
                <p className="text-gray-500">Loading specials…</p>
            ) : specials.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600">
                    No specials yet. Add one to offer a dish at a lower price for a time.
                </p>
            ) : (
                <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Specials">
                    {specials.map((s) => (
                        <li key={s.id} className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="truncate text-base font-semibold text-gray-900">{s.itemName}</h3>
                                    <p className="text-xs text-gray-500">{[s.menuName, s.categoryName].filter(Boolean).join(" · ")}</p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[s.status]?.className ?? ""}`}>
                                    {STATUS[s.status]?.label ?? s.status}
                                </span>
                            </div>
                            <p className="mt-3 text-sm">
                                <span className="font-semibold text-gray-900">{formatPrice(s.specialPrice, s.currency ?? currency)}</span>{" "}
                                <s className="text-gray-500">{formatPrice(s.regularPrice, s.currency ?? currency)}</s>
                            </p>
                            <p className="mt-1 text-sm text-gray-700">{scheduleOf(s)}</p>
                            {s.note && <p className="mt-1 text-sm text-gray-600">{s.note}</p>}
                            <div className="mt-4 flex flex-wrap gap-2">
                                <Button variant="secondary" onClick={() => setEditing(s)}>Edit</Button>
                                <Button variant="secondary" onClick={() => setPaused(s, !s.paused)}>{s.paused ? "Resume" : "Pause"}</Button>
                                <Button variant="danger" onClick={() => setDeleting(s)}>Delete</Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <SpecialDialog
                open={editing !== null}
                onClose={() => setEditing(null)}
                dishes={dishes}
                special={editing && editing !== "new" ? editing : undefined}
                currency={currency}
                onSave={save}
            />

            <Modal open={deleting !== null} onClose={() => setDeleting(null)}>
                <ModalHeader title="Delete special?" onClose={() => setDeleting(null)} />
                <p className="text-sm text-gray-700">
                    {deleting?.itemName} goes back to its regular price. This can't be undone.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
                    <Button variant="danger" onClick={confirmDelete}>Delete special</Button>
                </div>
            </Modal>
        </div>
    );
}
