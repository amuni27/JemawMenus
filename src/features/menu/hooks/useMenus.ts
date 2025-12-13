import { useEffect, useState } from 'react';
import * as api from '../../../api/menuApi';
import { Menu } from '../../../types/menu';

export function useMenus(tenantId?: string) {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    api.listMenus(tenantId).then((m) => {
      setMenus(m);
      setLoading(false);
    });
  }, [tenantId]);

  const createMenu = async (payload: Omit<Menu, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!tenantId) return;
    const menu = await api.createMenu({ ...payload, tenantId });
    setMenus((prev) => [...prev, menu]);
  };

  return { menus, loading, createMenu, setMenus };
}
