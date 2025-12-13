import { useEffect, useState } from 'react';
import * as api from '../../../api/menuApi';
import { MenuItem, ItemStatus } from '../../../types/menu';

export function useItems(menuId?: string) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!menuId) return;
    setLoading(true);
    api.listItems(menuId).then((it) => {
      setItems(it);
      setLoading(false);
    });
  }, [menuId]);

  const createItem = async (item: Omit<MenuItem, 'id' | 'menuId' | 'createdAt' | 'updatedAt'>) => {
    if (!menuId) return;
    const created = await api.createItem(menuId, item);
    setItems((prev) => [...prev, created]);
  };

  const toggleStatus = async (itemId: string) => {
    const current = items.find((i) => i.id === itemId);
    if (!current) return;
    const newStatus: ItemStatus = current.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    await api.updateItemStatus(itemId, newStatus);
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status: newStatus } : i)));
  };

  const updateItem = async (itemId: string, patch: Partial<MenuItem>) => {
    const updated = await api.updateItem(itemId, patch);
    if (!updated) return;
    setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
  };
  return { items, loading, createItem, updateItem, toggleStatus };
}
