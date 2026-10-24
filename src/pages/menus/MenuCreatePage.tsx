import { useNavigate, useParams } from "react-router-dom";
import menuApi from "../../api/menuApi";
import MenuWizard from "./MenuWizard";
import {Menu, MenuDto} from "../../types/menu";
import { useToast } from "../../components/ui/ToastContext";

export default function MenuCreatePage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSave = async (menu: MenuDto) => {
    if (!tenantSlug) return;
    const res = await menuApi.createMenu(menu as any);
    // PO-2: new menus start unpublished; tell the owner how to make it live (AGF-S1-15)
    if (res?.data?.active === false) toast("Menu created as Unpublished — publish it when it's ready.");
    navigate(`/${tenantSlug}/admin/menus`);
  };

  return <MenuWizard onSave={handleSave} />;
}
