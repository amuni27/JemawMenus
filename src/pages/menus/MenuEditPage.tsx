import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import menuApi from "../../api/menuApi";
import MenuWizard from "./MenuWizard";
import { Menu, MenuDto } from "../../types/menu";
import LoadError from "../../components/ui/LoadError";
import { errorMessage } from "../../utils/errorMessage";

export default function MenuEditPage() {
  const { tenantSlug, menuId } = useParams<{ tenantSlug: string; menuId: string }>();
  const navigate = useNavigate();

  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!menuId) return;
    menuApi
      .getMenu(menuId)
      .then((res: any) => setMenu(res.data))
      .catch((err: any) => setError(errorMessage(err, "Failed to load menu")))
      .finally(() => setLoading(false));
  }, [menuId, attempt]);

  const handleSave = async (data: MenuDto) => {
    if (!menuId || !tenantSlug) return;
    await menuApi.updateMenu(menuId, data);
    navigate(`/${tenantSlug}/admin/menus`);
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (error) return <div className="p-6"><LoadError message={error} onRetry={() => { setLoading(true); setError(""); setAttempt((n) => n + 1); }} /></div>;
  if (!menu) return <p className="p-6 text-red-600">Menu not found.</p>;

  const initial: Partial<MenuDto> = {
    name: menu.name,
    menuTypeId: menu.menuType?.id ?? menu.menuTypeId,
    description: menu.description,
    visibility: "PUBLIC",
  };

  return <MenuWizard initial={initial} onSave={handleSave} />;
}