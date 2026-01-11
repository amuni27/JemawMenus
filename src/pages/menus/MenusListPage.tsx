import {useEffect, useState} from "react";
import {Link, useNavigate, useParams} from "react-router-dom";
import {Menu, MenuItem} from "../../types/menu";
import menuApi from "../../api/menuApi";
import MenuQrModal from "../../components/menu/MenuQrModal";
import QRCode from "react-qr-code";
import {buildMenuUrl} from "../../utils/buildMenuUrl";
import {useAuth} from "../../app/context/AuthContext.tsx";
import DeleteCategoryModal from "../../features/menu/components/DeleteCategoryModal.tsx";
import {useMenus} from "../../features/menu/hooks/useMenus.ts";

export default function MenusListPage() {
    const nav = useNavigate();
    const auth = useAuth();
    const {tenantSlug} = useParams();
    const {deleteMenu}= useMenus();
    useNavigate();
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
        console.log("start menue list page ....")
        const response = await menuApi.listMenus();
        if (response.status === 401) {
            nav('/auth/login');
        }
        setMenus(response.data);
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, [tenantSlug]);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      setDeleteLoading(true);
      setDeleteError("");
      await deleteMenu(deleting.id);
      closeDelete();
    } catch (err: any) {
      setDeleteError(err?.response?.data?.message || err?.message || "Failed to delete category");
    } finally {
      setDeleteLoading(false);
    }
  };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Menus</h2>
                <Link
                    to={`/${tenantSlug}/admin/menus/new`}
                    className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark"
                >
                    Create Menu
                </Link>
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : menus.length === 0 ? (
                <div className="bg-white border border-gray-200 p-6 rounded-2xl text-center">
                    <p className="mb-4">No menus yet.</p>
                    <Link
                        to={`/${tenantSlug}/admin/menus/new`}
                        className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark"
                    >
                        Create your first menu
                    </Link>
                </div>
            ) : (
                <div className="overflow-x-auto bg-white border border-gray-200 rounded-2xl shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                            </th>
                            <th className="px-6 py-3 text-right"></th>
                        </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {menus.map((menu) => (
                            <tr key={menu.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    <Link
                                        to={`/${auth.business?.id}/admin/menus/${menu.id}`}
                                        className="text-blue-600 hover:underline"
                                    >
                                        {menu.name}
                                    </Link>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {menu.menuType.name
                                    }
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <Link
                                        to={`/${tenantSlug}/admin/menus/${menu.id}/edit`}
                                        className="text-indigo-600 hover:underline"
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        onClick={() => openDelete(menu)}
                                        className="text-red-600 hover:underline"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
            {qrMenu && tenantSlug && (
                <MenuQrModal tenantSlug={tenantSlug} menuId={qrMenu.id} onClose={() => setQrMenu(null)}/>
            )}
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