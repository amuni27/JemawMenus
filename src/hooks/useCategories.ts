import { useEffect, useState } from "react";
import type { Category } from "../types/menu.ts";
import categoryApi from "../api/categoriesApi.ts"; // adjust path if needed

export function useCategories(menuId?: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!menuId) return;

    let alive = true;
    setLoading(true);
    setError("");

    categoryApi
        .getCategories(menuId)
        .then((res: any) => {
          if (!alive) return;
          // if axios: res.data, if your service returns data directly: res
          const data = res?.data ?? res;
          // Saved order (AGF-S2-07); the API already sorts, a stable sort keeps its tie-break
          setCategories(Array.isArray(data) ? [...data].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : data);
        })
        .catch((err: any) => {
          if (!alive) return;
          setError(err?.message || "Failed to load categories");
          setCategories([]);
        })
        .finally(() => {
          if (!alive) return;
          setLoading(false);
        });

    return () => {
      alive = false;
    };
  }, [menuId]);

  const createCategory = async (name: string) => {
    if (!menuId) throw new Error("menuId is required");
    const created = await categoryApi.createCategory(menuId, { name });
    const cat = created?.data ?? created;
    // The backend places a new category after the existing ones (AGF-S2-07)
    setCategories((prev) => [...prev, cat]);
    return cat as Category;
  };

  const updateCategory = async (categoryId: string, name: string) => {
    const updated = await categoryApi.updateCategory(categoryId, { name });
    const cat = updated?.data ?? updated;
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? cat : c)));
    return cat as Category;
  };

  // Hide or show a category for guests (AGF-S1-15); the owner keeps seeing it
  const setCategoryActive = async (categoryId: string, active: boolean) => {
    const updated = await categoryApi.updateCategory(categoryId, { isActive: active });
    const cat = updated?.data ?? updated;
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, ...cat, active: cat?.active ?? active } : c)));
    return cat as Category;
  };

  const deleteCategory = async (categoryId: string) => {
      await categoryApi.deleteCategory(categoryId);
    setCategories((prev) => prev.filter((c) => (c.id !== categoryId )));
  };

  // AGF-S2-07: save a new order of all categories. Shown at once, then saved; if saving fails the previous
  // order comes back and the error is rethrown for the caller to show. An unchanged order is not sent (S2-07A).
  const setCategoryOrder = async (orderedIds: string[]) => {
    if (!menuId) throw new Error("menuId is required");
    const previous = categories;
    const byId = new Map(previous.map((c) => [c.id, c]));
    const next = orderedIds.map((id) => byId.get(id)).filter((c): c is Category => Boolean(c));
    if (next.length !== previous.length) return;
    if (next.every((c, i) => c.id === previous[i].id)) return;

    setCategories(next.map((c, i) => ({ ...c, sortOrder: i })));
    try {
      await categoryApi.reorderCategories(menuId, next.map((c) => c.id));
    } catch (err) {
      setCategories(previous);
      throw err;
    }
  };

  // AGF-S2-07: move one place up (-1) or down (+1)
  const moveCategory = async (categoryId: string, direction: -1 | 1) => {
    const ids = categories.map((c) => c.id);
    const from = ids.indexOf(categoryId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    await setCategoryOrder(ids);
  };

  return {
    categories,
    loading,
    error,
    setCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    setCategoryActive,
    moveCategory,
    setCategoryOrder,
  };
}
