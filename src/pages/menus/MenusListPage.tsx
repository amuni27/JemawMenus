import {useEffect, useState} from "react";
import {Link, useNavigate, useParams} from "react-router-dom";
import {Menu} from "../../types/menu";
import menuApi from "../../api/menuApi";
import MenuQrModal from "../../components/menu/MenuQrModal";
import {useAuth} from "../../app/context/AuthContext";
import DeleteCategoryModal from "../../components/menu/DeleteCategoryModal.tsx";
import {useMenus} from "../../hooks/useMenus";

export default function MenusListPage() {
    const nav = useNavigate();
    const auth = useAuth();
    const {tenantSlug} = useParams();
    const {deleteMenu} = useMenus();

    const [menus, setMenus] = useState<Menu[]>([]);
    const [qrMenu, setQrMenu] = useState<Menu | null>(null);
    const [loading, setLoading] = useState(true);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<Menu>();
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    const openDelete = (menu: Menu) => {
        setDeleting(menu);
        setDeleteError("");
        setDeleteOpen(true);
    };

    const closeDelete = () => {
        setDeleteOpen(false);
        setDeleting(undefined);
        setDeleteError("");
    };

    const load = async () => {
        setLoading(true);
        const response = await menuApi.listMenus();
        if (response.status === 401) {
            nav("/auth/login");
            return;
        }
        setMenus(response.data);
        setLoading(false);
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantSlug]);

    const confirmDelete = async () => {
        if (!deleting) return;
        try {
            setDeleteLoading(true);
            setDeleteError("");
            await deleteMenu(deleting.id);
            closeDelete();
            await load(); // refresh list after delete
        } catch (err: any) {
            setDeleteError(
                err?.response?.data?.message || err?.message || "Failed to delete menu"
            );
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <nav className="mb-1 text-sm text-gray-500">
                    Venue
                    <span className="mx-1">/</span>
                    <span>menus</span>
                    <h2 className="text-2xl font-bold">Menus</h2>
                </nav>


                <Link
                    to={`/${tenantSlug}/admin/menus/new`}
                    className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-white hover:bg-brand-dark w-full sm:w-auto"
                >
                    Create Menu
                </Link>
            </div>

            {/* Content */}
            {loading ? (
                <p className="text-gray-600">Loading...</p>
            ) : menus.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
                    <p className="mb-4 text-gray-700">No menus yet.</p>
                    <Link
                        to={`/${tenantSlug}/admin/menus/new`}
                        className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-white hover:bg-brand-dark w-full sm:w-auto"
                    >
                        Create your first menu
                    </Link>
                </div>
            ) : (
                <>
                    {/* Mobile / Small screens: Cards */}
                    <div className="grid gap-3 md:hidden">
                        {menus.map((menu) => (
                            <div
                                key={menu.id}
                                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <Link
                                            to={`/${auth.business?.id}/admin/menus/${menu.id}`}
                                            className="block truncate text-base font-semibold text-gray-900 hover:underline"
                                            title={menu.name}
                                        >
                                            {menu.name}
                                        </Link>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {menu.menuType?.name}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-3">
                                        <Link
                                            to={`/${tenantSlug}/admin/menus/${menu.id}/edit`}
                                            className="text-sm font-medium text-indigo-600 hover:underline"
                                        >
                                            Edit
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => openDelete(menu)}
                                            className="text-sm font-medium text-red-600 hover:underline"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                {/* Optional: extra actions row (if you later add QR, etc.) */}
                                {/* <div className="mt-3 flex gap-2">
                  <button onClick={() => setQrMenu(menu)} className="text-sm text-blue-600">QR</button>
                </div> */}
                            </div>
                        ))}
                    </div>

                    {/* Desktop / Tablet: Table */}
                    <div
                        className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Type
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                                    Actions
                                </th>
                            </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-200 bg-white">
                            {menus.map((menu) => (
                                <tr key={menu.id} className="hover:bg-gray-50/60">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                        <Link
                                            to={`/${auth.business?.id}/admin/menus/${menu.id}`}
                                            className="text-blue-600 hover:underline"
                                        >
                                            {menu.name}
                                        </Link>
                                    </td>

                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {menu.menuType?.name}
                                    </td>

                                    <td className="px-6 py-4 text-right text-sm font-medium">
                                        <div className="inline-flex items-center gap-4">
                                            <Link
                                                to={`/${tenantSlug}/admin/menus/${menu.id}/edit`}
                                                className="text-indigo-600 hover:underline"
                                            >
                                                Edit
                                            </Link>

                                            <button
                                                type="button"
                                                onClick={() => openDelete(menu)}
                                                className="text-red-600 hover:underline"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* QR modal */}
            {qrMenu && tenantSlug && (
                <MenuQrModal
                    tenantSlug={tenantSlug}
                    menuId={qrMenu.id}
                    onClose={() => setQrMenu(null)}
                />
            )}

            {/* Delete modal */}
            <DeleteCategoryModal
                open={deleteOpen}
                name={deleting?.name}
                loading={deleteLoading}
                error={deleteError}
                onClose={closeDelete}
                onConfirm={confirmDelete}
            />
        </div>
    );
}
