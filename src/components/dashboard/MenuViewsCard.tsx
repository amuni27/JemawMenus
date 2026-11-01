import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import menuViewsApi, { type MenuViewDay } from "../../api/menuViewsApi";

// AGF-S2-24 (D-S2-24-1, -7): how often the guest menu was opened. Loaded on its own, so a failure here leaves the
// rest of the dashboard untouched. The backend returns consecutive days, oldest first, ending today.

const DAYS = 30;
const STRIP_DAYS = 14;

const sum = (days: MenuViewDay[]) => days.reduce((total, d) => total + d.views, 0);

export default function MenuViewsCard({ businessId }: { businessId: string }) {
    const [days, setDays] = useState<MenuViewDay[] | null>(null);
    const [today, setToday] = useState(0);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        menuViewsApi.get(businessId, DAYS).then(
            (res) => {
                if (!alive) return;
                setDays(res.data.days ?? []);
                setToday(res.data.today ?? 0);
            },
            () => alive && setFailed(true)
        );
        return () => { alive = false; };
    }, [businessId]);

    const strip = (days ?? []).slice(-STRIP_DAYS);
    const peak = Math.max(1, ...strip.map((d) => d.views));
    const total30 = sum(days ?? []);

    return (
        <section aria-labelledby="dash-views" className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 id="dash-views" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Eye aria-hidden="true" className="h-4 w-4" /> Menu views
            </h3>
            {failed ? (
                <p className="mt-3 text-sm text-gray-500">Views unavailable</p>
            ) : !days ? (
                <p className="mt-3 text-sm text-gray-500">Loading views…</p>
            ) : (
                <>
                    <dl className="mt-3 grid grid-cols-3 gap-3">
                        {[
                            { label: "Today", value: today, id: "views-today" },
                            { label: "Last 7 days", value: sum(days.slice(-7)), id: "views-7" },
                            { label: "Last 30 days", value: total30, id: "views-30" },
                        ].map((s) => (
                            <div key={s.id} className="rounded-xl border border-gray-100 p-3 text-center">
                                <dd data-testid={s.id} className="text-2xl font-bold text-gray-900">{s.value}</dd>
                                <dt className="mt-1 text-xs text-gray-600">{s.label}</dt>
                            </div>
                        ))}
                    </dl>
                    {total30 === 0 && <p className="mt-3 text-sm text-gray-600">No views yet. Share your QR code to start.</p>}
                    <ul aria-label="Daily views, last 14 days" className="mt-4 flex h-16 items-end gap-1">
                        {strip.map((d) => (
                            <li key={d.date} className="flex h-full flex-1 items-end" title={`${d.date}: ${d.views}`}>
                                <span
                                    aria-hidden="true"
                                    className="block w-full rounded-t bg-brand"
                                    style={{ height: `${Math.max(d.views > 0 ? 8 : 2, (d.views / peak) * 100)}%` }}
                                />
                                <span className="sr-only">{d.date}: {d.views} {d.views === 1 ? "view" : "views"}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-xs text-gray-500">
                        Counts how often your guest menu was opened, including reloads. Not unique visitors.
                    </p>
                </>
            )}
        </section>
    );
}
