import { useCallback, useEffect, useRef, useState } from "react";
import itemApi from "../api/itemsApi.ts";
import type { MenuItem, ItemStatus, CreateItemPayload } from "../types/menu.ts";


type UploadInfo = { uploadUrl: string; objectKey: string; expiresInSeconds?: number };
type PresignResponse = { item: MenuItem; upload?: UploadInfo | null };

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

/** axios-like: response can be { data: ... } or already data */
function unwrapData<T>(res: unknown): T {
    if (isObject(res) && "data" in res) return (res as any).data as T;
    return res as T;
}

/** create endpoint may return MenuItem or { item, upload } */
function unwrapCreatedItem(res: unknown): MenuItem {
    const data = unwrapData<any>(res);
    if (data && typeof data === "object" && "item" in data) return data.item as MenuItem;
    return data as MenuItem;
}

/** make sure we never call .map/filter with undefined list */
function safeArray<T>(v: unknown): T[] {
    return Array.isArray(v) ? (v as T[]) : [];
}

export function useItems(menuId?: string) {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");

    // Prevent state updates after unmount or menuId change
    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
        };
    }, []);

    const safeSetItems = useCallback((updater: (prev: MenuItem[]) => MenuItem[]) => {
        if (!aliveRef.current) return;
        setItems((prev) => updater(prev));
    }, []);

    const safeSetLoading = useCallback((v: boolean) => {
        if (!aliveRef.current) return;
        setLoading(v);
    }, []);

    const safeSetError = useCallback((v: string) => {
        if (!aliveRef.current) return;
        setError(v);
    }, []);

    // --------- initial load / reload on menuId ----------
    useEffect(() => {
        if (!menuId) return;

        let cancelled = false;
        safeSetLoading(true);
        safeSetError("");

        itemApi
            .list(menuId)
            .then((res) => {
                if (cancelled || !aliveRef.current) return;
                const data = unwrapData<unknown>(res);
                const list = safeArray<MenuItem>(data);
                setItems(list);
            })
            .catch((e: any) => {
                if (cancelled || !aliveRef.current) return;
                setItems([]);
                safeSetError(e?.response?.data?.message || e?.message || "Failed to load items");
            })
            .finally(() => {
                if (cancelled || !aliveRef.current) return;
                safeSetLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [menuId, safeSetError, safeSetLoading]);

    // --------- actions ----------
    const createItem = useCallback(
        async (payload: CreateItemPayload): Promise<MenuItem> => {
            if (!menuId) throw new Error("menuId is required");
            safeSetError("");

            const res = await itemApi.create(menuId, payload);

            // Create can be MenuItem OR { item, upload }
            const created = unwrapCreatedItem(res);

            // Stronger guard: ensure id exists (prevents /undefined/ calls later)
            if (!created?.id) {
                throw new Error("Create did not return a valid item id");
            }

            safeSetItems((prev) => [...prev, created]);
            return created;
        },
        [menuId, safeSetError, safeSetItems]
    );

    const updateItem = useCallback(
        async (itemId: string, patch: Partial<MenuItem>): Promise<MenuItem> => {
            safeSetError("");

            // IMPORTANT: never send imageUrl in normal update
            const { imageUrl: _ignore, ...safePatch } = patch as any;

            const res = await itemApi.update(itemId, safePatch);
            const updated = unwrapData<MenuItem>(res);

            safeSetItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
            return updated;
        },
        [safeSetError, safeSetItems]
    );

    const toggleStatus = useCallback(
        async (itemId: string): Promise<MenuItem | undefined> => {
            const current = items.find((i) => i.id === itemId);
            if (!current) return;

            // Hide: AVAILABLE or OUT_OF_STOCK -> UNAVAILABLE; Show: UNAVAILABLE -> AVAILABLE
            const body: { status: ItemStatus } = {
                status: current.status === "UNAVAILABLE" ? "AVAILABLE" : "UNAVAILABLE",
            };

            safeSetError("");
            const res = await itemApi.updateStatus(itemId, body);
            const updated = unwrapData<MenuItem>(res);

            safeSetItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
            return updated;
        },
        [items, safeSetError, safeSetItems]
    );

    // Mark sold out: AVAILABLE -> OUT_OF_STOCK; Back in stock: OUT_OF_STOCK -> AVAILABLE. No-op for hidden items.
    const toggleSoldOut = useCallback(
        async (itemId: string): Promise<MenuItem | undefined> => {
            const current = items.find((i) => i.id === itemId);
            if (!current || current.status === "UNAVAILABLE") return;

            const body: { status: ItemStatus } = {
                status: current.status === "OUT_OF_STOCK" ? "AVAILABLE" : "OUT_OF_STOCK",
            };

            safeSetError("");
            const res = await itemApi.updateStatus(itemId, body);
            const updated = unwrapData<MenuItem>(res);

            safeSetItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
            return updated;
        },
        [items, safeSetError, safeSetItems]
    );

    // AGF-S2-19: one bulk request, then the server's list (also after a failure, so the page never shows a guess)
    const markAllAvailable = useCallback(async (): Promise<number> => {
        if (!menuId) throw new Error("menuId is required");
        safeSetError("");
        const reload = async () => {
            const list = safeArray<MenuItem>(unwrapData<unknown>(await itemApi.list(menuId)));
            safeSetItems(() => list);
        };
        try {
            const res = await itemApi.markAllAvailable(menuId);
            const updated = Number(unwrapData<{ updated?: number }>(res)?.updated ?? 0);
            await reload();
            return updated;
        } catch (e) {
            await reload().catch(() => undefined);
            throw e;
        }
    }, [menuId, safeSetError, safeSetItems]);

    const deleteItem = useCallback(
        async (itemId: string): Promise<void> => {
            safeSetError("");
            await itemApi.remove(itemId);
            safeSetItems((prev) => prev.filter((i) => i.id !== itemId));
        },
        [safeSetError, safeSetItems]
    );

    // AGF-S2-08: save a new order for one category's items. Shown at once, then the category's full order is
    // saved; if saving fails the previous order comes back and the error is rethrown. An unchanged order is not
    // sent (S2-08A).
    const setItemOrder = useCallback(
        async (categoryId: string, orderedIds: string[]): Promise<void> => {
            const previous = items;
            // the category's items by saved position (stable: equal positions keep the list order)
            const inCategory = previous
                .filter((i) => i.categoryId === categoryId)
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            const byId = new Map(inCategory.map((i) => [i.id, i]));
            const reordered = orderedIds.map((id) => byId.get(id)).filter((i): i is MenuItem => Boolean(i));
            if (reordered.length !== inCategory.length || new Set(orderedIds).size !== orderedIds.length) return;
            if (reordered.every((i, k) => i.id === inCategory[k].id)) return;

            // Put the category's items back into the slots they held in the full list, in the new order
            let next = 0;
            const updated = previous.map((i) => {
                if (i.categoryId !== categoryId) return i;
                const placed = { ...reordered[next], sortOrder: next };
                next++;
                return placed;
            });
            safeSetItems(() => updated);
            try {
                await itemApi.reorder(categoryId, reordered.map((i) => i.id));
            } catch (err) {
                safeSetItems(() => previous);
                throw err;
            }
        },
        [items, safeSetItems]
    );

    // AGF-S2-08: move an item one place earlier (-1) or later (+1) within its category
    const moveItem = useCallback(
        async (itemId: string, direction: -1 | 1): Promise<void> => {
            const moving = items.find((i) => i.id === itemId);
            if (!moving) return;
            const ids = items
                .filter((i) => i.categoryId === moving.categoryId)
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((i) => i.id);
            const from = ids.indexOf(itemId);
            const to = from + direction;
            if (to < 0 || to >= ids.length) return;
            [ids[from], ids[to]] = [ids[to], ids[from]];
            await setItemOrder(moving.categoryId, ids);
        },
        [items, setItemOrder]
    );

    // --------- image upload helpers ----------
    const presignItemImage = useCallback(async (itemId: string, contentType: string): Promise<PresignResponse> => {
        const res = await itemApi.presignImage(itemId, contentType);
        const data = unwrapData<PresignResponse>(res);

        // Guard for contract correctness
        if (!data?.item?.id) {
            throw new Error("Presign response missing item");
        }

        return data;
    }, []);

    const confirmItemImage = useCallback(
        async (itemId: string, objectKey: string): Promise<MenuItem> => {
            const res = await itemApi.confirmImage(itemId, { objectKey });
            const confirmed = unwrapData<MenuItem>(res);

            // bust cache so user sees new image immediately
            const withCacheBust: MenuItem = {
                ...confirmed,
                imageUrl: confirmed.imageUrl
                    ? `${confirmed.imageUrl}${confirmed.imageUrl.includes("?") ? "&" : "?"}v=${Date.now()}`
                    : confirmed.imageUrl,
            };

            safeSetItems((prev) => prev.map((i) => (i.id === itemId ? withCacheBust : i)));
            return withCacheBust;
        },
        [safeSetItems]
    );

    // AGF-S2-16: the item comes back without a photo
    const removeItemImage = useCallback(
        async (itemId: string): Promise<MenuItem> => {
            const res = await itemApi.removeImage(itemId);
            const updated = unwrapData<MenuItem>(res);
            safeSetItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
            return updated;
        },
        [safeSetItems]
    );

    return {
        items,
        loading,
        error,
        setItems, // keeping exposed API exactly as you had
        createItem,
        updateItem,
        toggleStatus,
        toggleSoldOut,
        markAllAvailable,
        deleteItem,
        moveItem,
        setItemOrder,
        presignItemImage,
        confirmItemImage,
        removeItemImage,
    };
}
