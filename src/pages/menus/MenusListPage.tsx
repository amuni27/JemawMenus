import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Menu } from "../../types/menu";
import { deleteMenu, listMenus } from "../../api/menuApi";
import MenuQrModal from "../../components/menu/MenuQrModal";
import QRCode from "react-qr-code";
import { buildMenuUrl } from "../../utils/buildMenuUrl";

export default function MenusListPage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [qrMenu, setQrMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true);
    const data = await listMenus(tenantSlug);
    setMenus(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [tenantSlug]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this menu?")) return;
    await deleteMenu(id);
    load();
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QR</th>
                <th className="px-6 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {menus.map((menu) => (
                <tr key={menu.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <Link
                      to={`/${tenantSlug}/admin/menus/${menu.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {menu.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {menu.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="cursor-pointer" onClick={() => setQrMenu(menu)}>
                      <QRCode value={buildMenuUrl(tenantSlug!, menu.id)} size={48} level="M" />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Link
                      to={`/${tenantSlug}/admin/menus/${menu.id}/edit`}
                      className="text-indigo-600 hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(menu.id)}
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
        <MenuQrModal tenantSlug={tenantSlug} menuId={qrMenu.id} onClose={() => setQrMenu(null)} />
      )}
    </div>
  );
}