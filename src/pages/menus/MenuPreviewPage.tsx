import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import menuApi from "../../api/menuApi";
import CustomerMenu, { type GuestMenuPreview } from "../customer/CustomerMenu.tsx";
import MenuStatusBadge from "../../components/menu/MenuStatusBadge";
import LoadError from "../../components/ui/LoadError";
import { errorMessage, isNotFound } from "../../utils/errorMessage";
import NotFound from "../../components/NotFound";
import { menuStatus } from "../../utils/menuStatus";

const ADD_OFF = "Adding is off in preview";

type PreviewMenu = { id: string; name: string; active?: boolean; visibility?: string; categories?: unknown[] };
type PreviewData = { business?: GuestMenuPreview["business"]; menus: PreviewMenu[] };

/**
 * AGF-S2-17: the owner sees one of their menus exactly as guests would once it's published, from the owner-only
 * preview endpoint. Reuses the guest page with ordering off; never calls the public menu API.
 */
export default function MenuPreviewPage() {
    const { tenantSlug, menuId } = useParams<{ tenantSlug: string; menuId: string }>();
    const [data, setData] = useState<PreviewData | null>(null);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const [notFound, setNotFound] = useState(false); // AGF-S2-33

    useEffect(() => {
        if (!menuId) return;
        let alive = true;
        menuApi
            .previewMenu(menuId)
            .then((res) => {
                if (!alive) return;
                setData(res.data);
                setError("");
            })
            .catch((err) => {
                if (!alive) return;
                setNotFound(isNotFound(err));
                setError(errorMessage(err, "Failed to load the preview"));
            });
        return () => {
            alive = false;
        };
    }, [menuId, attempt]);

    const menu = data?.menus?.[0];
    const live = menu ? menuStatus(menu) === "Live" : false;
    const backTo = `/${tenantSlug}/admin/menus/${menuId}`;

    if (notFound) return <NotFound context="owner" fullPage />;
    if (error) {
        return (
            <div className="mx-auto max-w-2xl p-6">
                <LoadError
                    message={error}
                    onRetry={() => {
                        setError("");
                        setAttempt((n) => n + 1);
                    }}
                />
                <Link to={backTo} className="mt-4 inline-block text-sm text-gray-600 hover:underline">Back to menu</Link>
            </div>
        );
    }

    if (!data || !menu) return <p className="p-6 text-gray-600">Loading preview…</p>;

    return (
        <div className="bg-white">
            <section
                aria-label="Preview"
                className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
            >
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{live ? "Guests can see this menu" : "Preview — not visible to guests"}</span>
                    <MenuStatusBadge menu={menu} />
                    <span className="text-amber-800">{menu.name}</span>
                </div>
                <Link to={backTo} className="font-medium underline hover:no-underline">Back to menu</Link>
            </section>

            {(menu.categories ?? []).length === 0 ? (
                <div className="mx-auto max-w-2xl px-4 py-12 text-center">
                    <p className="text-base font-semibold text-gray-900">Guests would see "Menu coming soon"</p>
                    <p className="mt-1 text-sm text-gray-600">Add an active category with available items to this menu.</p>
                </div>
            ) : (
                <CustomerMenu preview={{ business: data.business, menus: data.menus as unknown as GuestMenuPreview["menus"], addDisabledLabel: ADD_OFF }} />
            )}
        </div>
    );
}
