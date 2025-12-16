import { useEffect, useState } from "react";
import * as api from "../../../api/itemsApi";
import type { MenuItem, ItemStatus } from "../../../types/menu";

type CreateItemPayload = {
  name: string;
  price: number;
  categoryId: string;
  ingredients: string[]; // jsonb array of strings
  description?: string | null;
  imageUrl?: string | null;
  calories?: number | null;
  allergens?: string[] | null;
  tags?: string[] | null;
  isFeatured?: boolean;
  prepTimeMinutes?: number | null;
  spiceLevel?: "NONE" | "MILD" | "MEDIUM" | "HOT" | null;
  status?: ItemStatus;
};

export function useItems(menuId?: string) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // ✅ helper to support both: axiosResponse OR plain data
  const unwrap = <T,>(res: any): T => (res?.data ?? res) as T;

  useEffect(() => {
    if (!menuId) return;

    let alive = true;
    setLoading(true);
    setError("");

    api
        .list(menuId)
        .then((res) => {
          if (!alive) return;
          setItems(unwrap<MenuItem[]>(res));
        })
        .catch((e: any) => {
          if (!alive) return;
          setError(e?.response?.data?.message || e?.message || "Failed to load items");
          setItems([]);
        })
        .finally(() => {
          if (!alive) return;
          setLoading(false);
        });

    return () => {
      alive = false;
    };
  }, [menuId]);

  // ✅ CREATE: must hit POST /menus/:menuId/items
  const createItem = async (payload: CreateItemPayload) => {
    if (!menuId) throw new Error("menuId is required");

    setError("");
    const res = await api.create(menuId, payload);
    const created = unwrap<MenuItem>(res);

    // optional: push to end or start
    setItems((prev) => [...prev, created]);
    return created;
  };

  const updateItem = async (itemId: string, patch: Partial<MenuItem>) => {
    setError("");
    const res = await api.update(itemId, patch);
    const updated = unwrap<MenuItem>(res);

    setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    return updated;
  };

  const toggleStatus = async (itemId: string) => {
    const current = items.find((i) => i.id === itemId);
    if (!current) return;

    const newStatus: ItemStatus =
        current.status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";

    setError("");
    await api.updateStatus(itemId, newStatus);

    setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, status: newStatus } : i))
    );
  };

  return { items, loading, error, setItems, createItem, updateItem, toggleStatus };
}
