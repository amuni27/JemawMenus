import { useEffect, useState } from "react";
import menuApi from "../../../api/menuApi";
import { Menu } from "../../../types/menu";
import itemApi from "../../../api/itemsApi.ts";

export function useMenus(tenantId?: string) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    setLoading(true);

    menuApi
        .listMenus()
        .then((res: any) => {
          console.log(res.data);
          setMenus(res.data);
        })
        .finally(() => setLoading(false));
  }, [tenantId]);

  const createMenu = async (
      payload: Omit<Menu, "id" | "tenantId" | "createdAt" | "updatedAt">
  ) => {
    if (!tenantId) return;

    const res: any = await menuApi.createMenu({
      ...payload,
      tenantId,
    });

    setMenus((prev) => [...prev, res.data]);
  };

  const deleteMenu = async (menuId: string) => {
    await menuApi.deleteMenu(menuId);

    // remove from UI
    setMenus((prev) => prev.filter((i) => i.id !== menuId));
  };

  return { menus, loading,deleteMenu, createMenu, setMenus };
}
