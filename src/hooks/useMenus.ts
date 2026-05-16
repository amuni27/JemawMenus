import { useEffect, useState } from "react";
import menuApi from "../api/menuApi.ts";
import {Menu, MenuDto} from "../types/menu.ts";

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
      payload: MenuDto
  ) => {
    if (!businessId) return;

    const res: any = await menuApi.createMenu(payload);

    setMenus((prev) => [...prev, res.data]);
  };

  const updateMenu = async (menuId: string, payload: MenuDto) => {
    const res: any = await menuApi.updateMenu(menuId, payload);
    setMenus((prev) => prev.map((m) => (m.id === menuId ? res.data : m)));
  };

  const deleteMenu = async (menuId: string) => {
    await menuApi.deleteMenu(menuId);
    setMenus((prev) => prev.filter((i) => i.id !== menuId));
  };

  return { menus, loading, deleteMenu, createMenu, updateMenu, setMenus };
}
