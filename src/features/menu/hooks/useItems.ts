import { useEffect, useState } from "react";
import itemApi from "../../../api/itemsApi";
import type {MenuItem, ItemStatus, CreateItemPayload} from "../../../types/menu";



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

    itemApi
        .list(menuId)
        .then((res) => {
          if (!alive) return;
          console.log("row res", res)
          console.log("unwined res", unwrap<MenuItem[]>(res))
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
    const res = await itemApi.create(menuId, payload);
    const created = unwrap<MenuItem>(res);

    // optional: push to end or start
    setItems((prev) => [...prev, created]);
    return created;
  };

  const updateItem = async (itemId: string, patch: Partial<MenuItem>) => {
    const res = await itemApi.update(itemId, patch);
    const updated = unwrap<MenuItem>(res);

    setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    return updated;
  };

  const toggleStatus = async (itemId: string) => {
    console.log("currentItem", itemId)
    const current = items.find((i) => i.id === itemId);
    console.log("currentItem data", current);
    if (!current) return;


    const body: ItemStatus = current.status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";


    setError("");
    const res = await itemApi.updateStatus(itemId, body);
    console.log("endewerede toggle res",res)
    const updated = unwrap<MenuItem>(res);
    console.log("updated toggle res",res)

    setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    return updated;
  };


  const deleteItem = async (itemId: string) => {
    setError("");
    await itemApi.remove(itemId);

    // remove from UI
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  return { items, loading, error, setItems, createItem, updateItem, toggleStatus,deleteItem };
}
