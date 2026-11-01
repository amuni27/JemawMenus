import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, PackageX, Plus, QrCode, TriangleAlert } from "lucide-react";
import menuApi from "../../api/menuApi";
import itemApi from "../../api/itemsApi.ts";
import LoadError from "../../components/ui/LoadError";
import MenuViewsCard from "../../components/dashboard/MenuViewsCard";
import PlanCard from "../../components/plan/PlanCard";
import { MENU_STATUS_CLASSES, menuStatus, type MenuStatus } from "../../utils/menuStatus";
import { publicMenuUrl } from "../../utils/publicMenuUrl";
import { errorMessage } from "../../utils/errorMessage";

// AGF-S2-09: at-a-glance owner home (backlog scope only): menus by status, sold-out items with a link to the
// filtered items view, a warning when no menu is live, and quick actions. Login still lands on Menus (D4).

type DashboardMenu = { id: string; name: string; active?: boolean; visibility?: string };
type SoldOutByMenu = { menu: DashboardMenu; count: number };
type DashboardData = { menus: DashboardMenu[]; soldOut: SoldOutByMenu[] };

const STATUSES: MenuStatus[] = ["Live", "Private", "Unpublished"];

function listFrom(res: unknown): unknown[] {
    const data = (res as { data?: unknown })?.data ?? res;
    return Array.isArray(data) ? data : [];
}

export default function Dashboard() {
    const { tenantSlug = "" } = useParams<{ tenantSlug: string }>();
    const [data, setData] = useState<DashboardData | null>(null);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                // Both endpoints are scoped to the signed-in owner's business by the backend (S1-06)
                const menus = listFrom(await menuApi.listMenus()) as DashboardMenu[];
                const soldOut = await Promise.all(
                    menus.map(async (menu) => ({ menu, count: listFrom(await itemApi.listSoldOut(menu.id)).length }))
                );
                if (alive) setData({ menus, soldOut });
            } catch (err) {
                if (alive) setError(errorMessage(err, "Couldn't load your dashboard. Please try again."));
            }
        })();
        return () => { alive = false; };
    }, [attempt]);

    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<MenuStatus, number>;
    for (const m of data?.menus ?? []) counts[menuStatus(m)] += 1;
    const withSoldOut = (data?.soldOut ?? []).filter((s) => s.count > 0);
    const soldOutTotal = withSoldOut.reduce((sum, s) => sum + s.count, 0);
    const guestMenuUrl = tenantSlug ? publicMenuUrl(tenantSlug) : null;
    const soldOutLink = (menuId: string) => `/${tenantSlug}/admin/menus/${menuId}?stock=sold-out`;

    return (
        <div className="space-y-6">
            <div>
                <nav className="mb-1 text-sm text-gray-500">Venue</nav>
                <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
            </div>

            {error ? (
                <LoadError
                    message={error}
                    onRetry={() => {
                        setError("");
                        setData(null);
                        setAttempt((a) => a + 1);
                    }}
                />
            ) : !data ? (
                <p className="text-gray-500">Loading dashboard…</p>
            ) : (
                <>
                    {counts.Live === 0 && (
                        <div
                            role="status"
                            aria-label="Menu coming soon"
                            className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <span className="flex items-start gap-2">
                                <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                                Guests see "Menu coming soon" — publish a menu.
                            </span>
                            <Link to={`/${tenantSlug}/admin/menus`} className="font-semibold underline hover:no-underline">
                                Go to Menus
                            </Link>
                        </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                        <section aria-labelledby="dash-menus" className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                            <h3 id="dash-menus" className="text-sm font-semibold text-gray-700">Menus</h3>
                            {data.menus.length === 0 && <p className="mt-1 text-sm text-gray-500">You have no menus yet.</p>}
                            <dl className="mt-3 grid grid-cols-3 gap-3">
                                {STATUSES.map((s) => (
                                    <div key={s} className="rounded-xl border border-gray-100 p-3 text-center">
                                        <dd data-testid={`menus-${s.toLowerCase()}`} className="text-2xl font-bold text-gray-900">
                                            {counts[s]}
                                        </dd>
                                        <dt className="mt-1">
                                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${MENU_STATUS_CLASSES[s]}`}>
                                                {s}
                                            </span>
                                        </dt>
                                    </div>
                                ))}
                            </dl>
                        </section>

                        <section aria-labelledby="dash-soldout" className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                            <h3 id="dash-soldout" className="text-sm font-semibold text-gray-700">Sold-out items</h3>
                            <div className="mt-3 flex items-center gap-3">
                                <PackageX aria-hidden="true" className="h-8 w-8 shrink-0 text-gray-400" />
                                {soldOutTotal === 0 ? (
                                    <p className="text-lg font-semibold text-gray-900">No items sold out</p>
                                ) : (
                                    <Link to={soldOutLink(withSoldOut[0].menu.id)} className="text-lg font-semibold text-amber-700 underline hover:no-underline">
                                        {soldOutTotal} {soldOutTotal === 1 ? "item" : "items"} sold out
                                    </Link>
                                )}
                            </div>
                            {withSoldOut.length > 1 && (
                                <ul className="mt-3 space-y-1 text-sm">
                                    {withSoldOut.map((s) => (
                                        <li key={s.menu.id}>
                                            <Link to={soldOutLink(s.menu.id)} className="text-gray-700 underline hover:no-underline">
                                                {s.menu.name}: {s.count} sold out
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    {/* AGF-S2-24 */}
                    {tenantSlug && <MenuViewsCard businessId={tenantSlug} />}
                    {tenantSlug && <PlanCard accountHref={`/${tenantSlug}/admin/account`} />}

                    <section aria-labelledby="dash-actions" className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <h3 id="dash-actions" className="text-sm font-semibold text-gray-700">Quick actions</h3>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <Link to={`/${tenantSlug}/admin/menus/new`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
                                <Plus aria-hidden="true" className="h-4 w-4" /> Create menu
                            </Link>
                            <Link to={`/${tenantSlug}/admin/qrcode`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                                <QrCode aria-hidden="true" className="h-4 w-4" /> View QR code
                            </Link>
                            {guestMenuUrl ? (
                                <a
                                    href={guestMenuUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                                >
                                    <ExternalLink aria-hidden="true" className="h-4 w-4" /> Open guest menu
                                </a>
                            ) : (
                                // AGF-S2-20: invalid configured address → no link (fail closed)
                                <span className="inline-flex items-center justify-center rounded-xl border border-dashed border-gray-200 px-4 py-2.5 text-sm text-gray-500">
                                    Guest menu link unavailable
                                </span>
                            )}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
