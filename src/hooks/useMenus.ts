import { useEffect, useState } from "react";
import menuApi from "../api/menuApi.ts";
import { Menu } from "../types/menu.ts";

export function useMenus(businessId?: string) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!businessId) return;

    setLoading(true);

    menuApi
        .listMenus()
        .then((res: any) => {
          console.log(res.data);
          setMenus(res.data);
        })
        .finally(() => setLoading(false));
  }, [businessId]);

  const createMenu = async (
      payload: Omit<Menu, "id" | "menuId" | "businessId" | "createdAt" | "updatedAt">
  ) => {
    if (!businessId) return;

    const res: any = await menuApi.createMenu({
      ...payload,
      businessId,
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
