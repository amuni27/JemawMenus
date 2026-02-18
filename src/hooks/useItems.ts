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

            const body: { status: ItemStatus } = {
                status: current.status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
            };

            safeSetError("");
            const res = await itemApi.updateStatus(itemId, body);
            const updated = unwrapData<MenuItem>(res);

            safeSetItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
            return updated;
        },
        [items, safeSetError, safeSetItems]
    );

    const deleteItem = useCallback(
        async (itemId: string): Promise<void> => {
            safeSetError("");
            await itemApi.remove(itemId);
            safeSetItems((prev) => prev.filter((i) => i.id !== itemId));
        },
        [safeSetError, safeSetItems]
    );

    // --------- image upload helpers ----------
    const presignItemImage = useCallback(async (itemId: string): Promise<PresignResponse> => {
        const res = await itemApi.presignImage(itemId);
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

    return {
        items,
        loading,
        error,
        setItems, // keeping exposed API exactly as you had
        createItem,
        updateItem,
        toggleStatus,
        deleteItem,
        presignItemImage,
        confirmItemImage,
    };
}
