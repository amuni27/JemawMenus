import { useNavigate, useParams } from "react-router-dom";
import menuApi from "../../api/menuApi";
import MenuWizard from "./MenuWizard";
import {Menu, MenuDto} from "../../types/menu";

export default function MenuCreatePage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();

  const handleSave = async (menu: MenuDto) => {
    if (!tenantSlug) return;
    await menuApi.createMenu(menu as any);
    navigate(`/${tenantSlug}/admin/menus`);
  };

  return <MenuWizard onSave={handleSave} />;
}
