import { useEffect, useState } from "react";
import itemApi from "../../../api/itemsApi";
import type { MenuItem, ItemStatus, CreateItemPayload } from "../../../types/menu";

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

    const createItem = async (payload: CreateItemPayload) => {
        if (!menuId) throw new Error("menuId is required");

        setError("");
        const res = await itemApi.create(menuId, payload as any);
        const created = unwrap<MenuItem>(res);

        setItems((prev) => [...prev, created]);
        return created;
    };

    const updateItem = async (itemId: string, patch: Partial<MenuItem>) => {
        const res = await itemApi.update(itemId, patch as any);
        const updated = unwrap<MenuItem>(res);

        setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
        return updated;
    };

    const toggleStatus = async (itemId: string) => {
        const current = items.find((i) => i.id === itemId);
        if (!current) return;

        const body: { status: ItemStatus } = {
            status: current.status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
        };

        setError("");
        const res = await itemApi.updateStatus(itemId, body);
        const updated = unwrap<MenuItem>(res);

        setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
        return updated;
    };

    const deleteItem = async (itemId: string) => {
        setError("");
        await itemApi.remove(itemId);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
    };

    // ✅ NEW: presign upload URL for item image
    const presignItemImage = async (
        itemId: string
    ): Promise<{
        item: MenuItem;
        upload?: { uploadUrl: string; objectKey: string; expiresInSeconds?: number } | null;
    }> => {
        setError("");
        const res = await itemApi.presignImage(itemId);
        return unwrap(res);
    };

    // ✅ NEW: confirm uploaded image
    const confirmItemImage = async (itemId: string, objectKey: string): Promise<MenuItem> => {
        setError("");
        const res = await itemApi.confirmImage(itemId, { objectKey });
        const updated = unwrap<MenuItem>(res);

        setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
        return updated;
    };

    return {
        items,
        loading,
        error,
        setItems,
        createItem,
        updateItem,
        toggleStatus,
        deleteItem,
        presignItemImage,
        confirmItemImage,
    };
}
