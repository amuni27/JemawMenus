import { useEffect, useState } from 'react';
import * as api from '../../../api/menuApi';
import { Category } from '../../../types/menu';

export function useCategories(menuId?: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!menuId) return;
    setLoading(true);
    api.listCategories(menuId).then((c) => {
      setCategories(c);
      setLoading(false);
    });
  }, [menuId]);

  const createCategory = async (name: string) => {
    if (!menuId) return;
    const cat = await api.createCategory(menuId, name);
    setCategories((prev) => [...prev, cat]);
  };

  const updateCategory = async (id: string, name: string) => {
    const updated = await api.updateCategory(id, { name });
    if (!updated) return;
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };
  return { categories, loading, createCategory, updateCategory };
}
