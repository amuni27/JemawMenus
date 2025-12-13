import { useNavigate, useParams } from "react-router-dom";
import { createMenu } from "../../api/menuApi";
import MenuWizard, { MenuWizardData } from "./MenuWizard";
import { Menu } from "../../types/menu";

export default function MenuCreatePage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();

  const handleSave = async (data: MenuWizardData) => {
    if (!tenantSlug) return;
    const now = new Date().toISOString();
    const newMenu: Omit<Menu, "id"> = {
      tenantId: tenantSlug,
      name: data.name,
      type: data.type,
      description: data.description,
      currency: data.currency,
      createdAt: now,
      updatedAt: now,
    } as any;
    await createMenu(newMenu as any);
    navigate(`/${tenantSlug}/admin/menus`);
  };

  return <MenuWizard onSave={handleSave} />;
}
