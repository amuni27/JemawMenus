import { useCallback, useEffect, useState } from "react";
import planApi, { type OwnerNotice } from "../../api/planApi";
import { OWNER_SECONDARY, noticeText } from "./planText";

// AGF FE-R2 (assessment story 7; backend R5-03-D; N2 in register §69): the owner's notice list on Subscription & Plans. Only
// the restaurant's own delivered notices (the backend decides), newest first, written here from their data (plan, dates in the
// restaurant's time zone, amounts); never rendered as markup. "Mark as read" per unread notice. If notices can't be loaded, the
// section isn't shown and the rest of the page is unaffected.

export default function NoticeList() {
    const [items, setItems] = useState<OwnerNotice[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState("");

    const load = useCallback(() => Promise.resolve().then(() => planApi.notices())
        .then((res) => setItems(Array.isArray(res.data) ? res.data : []), () => setFailed(true)), []);
    useEffect(() => { load(); }, [load]);

    if (failed || !items) return null;

    const markRead = async (id: string) => {
        if (busy) return;
        setBusy(id);
        setError("");
        try {
            await planApi.readNotice(id);
            await load();
        } catch {
            setError("Couldn't mark the notice as read. Please try again.");
        } finally {
            setBusy(null);
        }
    };

    return (
        <section aria-labelledby="notices-heading" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 id="notices-heading" className="text-base font-semibold text-gray-900">Notices</h3>
            {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
            {items.length === 0 ? (
                <p className="mt-2 text-sm text-gray-700">No notices yet.</p>
            ) : (
                <ul aria-label="Notices" className="mt-3 divide-y divide-gray-200 text-sm">
                    {items.map((n) => (
                        <li key={n.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <p className={n.read ? "text-gray-700" : "font-semibold text-gray-900"}>
                                    {!n.read && <span className="mr-2 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-900">New</span>}
                                    {noticeText(n)}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-700">{new Date(n.createdAt).toLocaleString(undefined, n.data?.timeZone ? { timeZone: n.data.timeZone } : undefined)}</p>
                            </div>
                            {!n.read && (
                                <button type="button" className={OWNER_SECONDARY} disabled={busy !== null} onClick={() => markRead(n.id)}>Mark as read</button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
