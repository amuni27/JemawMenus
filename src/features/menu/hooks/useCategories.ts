import { useEffect, useState } from "react";
import type { Category } from "../../../types/menu";
import categoryApi from "../../../api/categoriesApi"; // adjust path if needed

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
          setCategories(data);
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

  // (optional) create/update functions can also live here
  const createCategory = async (name: string) => {
    if (!menuId) throw new Error("menuId is required");
    const created = await categoryApi.createCategory(menuId, { name });
    const cat = created?.data ?? created;
    setCategories((prev) => [cat, ...prev]);
    return cat as Category;
  };

  const updateCategory = async (categoryId: string, name: string) => {
    const updated = await categoryApi.updateCategory(categoryId, { name });
    const cat = updated?.data ?? updated;
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? cat : c)));
    return cat as Category;
  };

  return {
    categories,
    loading,
    error,
    setCategories,
    createCategory,
    updateCategory,
  };
}
