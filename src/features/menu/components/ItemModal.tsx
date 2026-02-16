import React, {useCallback, useEffect, useMemo, useState} from "react";
import Modal from "../../../components/ui/Modal";
import ModalHeader from "../../../components/ui/ModalHeader";
import Button from "../../../components/ui/Button";
import {Input} from "../../../components/ui/Input";
import {FormSelect} from "../../../components/form/FormSelect";
import type {MenuItem, Category, CreateItemPayload} from "../../../types/menu";
import {useToast} from "../../../components/ui/ToastContext";

type UploadInfo = { uploadUrl: string; objectKey: string; expiresInSeconds?: number };
type PresignResponse = { item: MenuItem; upload?: UploadInfo | null };

interface Props {
    open: boolean;
    onClose: () => void;
    menuId?: string;
    item?: MenuItem;
    categories: Category[];

    // Create base item (without image)
    onCreate: (payload: CreateItemPayload) => Promise<MenuItem>;
    // Update base item (without image)
    onUpdate: (itemId: string, patch: Partial<MenuItem>) => Promise<MenuItem>;

    // Confirm image by objectKey; backend returns updated item with public imageUrl set
    onConfirmImage: (itemId: string, objectKey: string) => Promise<MenuItem>;

    // Presign PUT upload URL for the item
    onPresignImage?: (itemId: string) => Promise<PresignResponse>;
}



type Draft = {
    name: string;
    description: string;
    price: string;
    calories: string;
    categoryId: string;
    status: "AVAILABLE" | "UNAVAILABLE";
    imageFile: File | null;
    imagePreview: string; // blob or public url
    ingredients: string[];
    ingredientInput: string;
};

function normalizeIngredients(raw: unknown): string[] {
    if (Array.isArray(raw)) {
        return raw
            .map((x) => (x == null ? "" : String(x).trim()))
            .filter((x) => x.length > 0);
    }
    if (typeof raw === "string" && raw.trim()) return [raw.trim()];
    return [];
}

function buildDraft(item: MenuItem | undefined, categories: Category[]): Draft {
    const defaultCategoryId = categories?.[0]?.id ?? "";
    if (item) {
        return {
            name: item.name ?? "",
            description: item.description ?? "",
            price: item.price != null ? String(item.price) : "",
            calories: item.calories != null ? String(item.calories) : "",
            categoryId: item.categoryId ?? defaultCategoryId,
            status: ((item.status as any) ?? "AVAILABLE") as Draft["status"],
            imageFile: null,
            imagePreview: item.imageUrl ?? "",
            ingredients: normalizeIngredients((item as any).ingredients),
            ingredientInput: "",
        };
    }

    return {
        name: "",
        description: "",
        price: "",
        calories: "",
        categoryId: defaultCategoryId,
        status: "AVAILABLE",
        imageFile: null,
        imagePreview: "",
        ingredients: [],
        ingredientInput: "",
    };
}

/**
 * Upload that adapts to how the backend presigned:
 * - If presigned URL signed "content-type", send Content-Type header.
 * - Otherwise do NOT send it (prevents 403 signature mismatch).
 */
async function uploadToR2(uploadUrl: string, file: File) {
    const url = new URL(uploadUrl);
    const signedHeaders = (url.searchParams.get("X-Amz-SignedHeaders") || "").toLowerCase();
    const mustSendContentType = signedHeaders.includes("content-type");

    const headers: Record<string, string> = {};
    if (mustSendContentType) {
        headers["Content-Type"] = file.type || "application/octet-stream";
    }

    const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers,
        mode: "cors",
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
    }
}

function isBlobUrl(url: string) {
    return typeof url === "string" && url.startsWith("blob:");
}

function formatMoneyInput(raw: string) {
    if (raw === "") return raw;
    if (/^\d*\.?\d{0,2}$/.test(raw)) return raw;
    return null;
}

export default function ItemModal({
                                      open,
                                      onClose,
                                      menuId,
                                      item,
                                      categories,
                                      onCreate,
                                      onUpdate,
                                      onConfirmImage,
                                      onPresignImage,
                                  }: Props) {
    const toast = useToast();

    const [draft, setDraft] = useState<Draft>(() => buildDraft(item, categories));
    const [touched, setTouched] = useState(false);

    // Step state is senior-grade UX (clear progress & debugging)
    const [step, setStep] = useState<"idle" | "saving" | "presigning" | "uploading" | "confirming">(
        "idle"
    );
    const submitting = step !== "idle";

    const [imgOk, setImgOk] = useState(true);

    const defaultCategoryId = useMemo(() => categories?.[0]?.id ?? "", [categories]);

    // Reset when modal opens
    useEffect(() => {
        if (!open) return;
        setDraft(buildDraft(item, categories));
        setTouched(false);
        setStep("idle");
        setImgOk(true);
    }, [open, item, categories]);

    // Ensure category on create
    useEffect(() => {
        if (!open) return;
        if (!item && !draft.categoryId && defaultCategoryId) {
            setDraft((d) => ({...d, categoryId: defaultCategoryId}));
        }
    }, [open, item, draft.categoryId, defaultCategoryId]);

    // ✅ Blob URL cleanup (prevents memory leaks)
    useEffect(() => {
        return () => {
            if (isBlobUrl(draft.imagePreview)) {
                URL.revokeObjectURL(draft.imagePreview);
            }
        };
    }, [draft.imagePreview]);

    const addIngredient = useCallback(() => {
        const val = (draft.ingredientInput ?? "").trim();
        if (!val) return;

        const exists = (draft.ingredients ?? []).some(
            (ing) => String(ing ?? "").toLowerCase() === val.toLowerCase()
        );
        if (exists) {
            setDraft((d) => ({...d, ingredientInput: ""}));
            return;
        }

        setDraft((d) => ({
            ...d,
            ingredients: [...(d.ingredients ?? []), val],
            ingredientInput: "",
        }));
    }, [draft.ingredientInput, draft.ingredients]);

    const removeIngredient = useCallback((ing: string) => {
        setDraft((d) => ({
            ...d,
            ingredients: (d.ingredients ?? []).filter((i) => i !== ing),
        }));
    }, []);

    const isValid = useCallback((): boolean => {
        if (!draft.name.trim()) return false;
        if (!draft.categoryId) return false;

        const priceNum = Number(draft.price);
        if (!draft.price || Number.isNaN(priceNum) || priceNum < 0) return false;

        if (draft.calories) {
            const calNum = Number(draft.calories);
            if (Number.isNaN(calNum) || calNum < 0) return false;
        }

        if ((draft.ingredients ?? []).length === 0) return false;

        // If user selected image, require presign hook
        if (draft.imageFile && !onPresignImage) return false;

        return true;
    }, [draft, onPresignImage]);

    const buildBasePayload = useCallback((): CreateItemPayload => {
        const priceNum = Number(draft.price);

        return {
            name: draft.name.trim(),
            price: priceNum,
            categoryId: draft.categoryId,
            ingredients: (draft.ingredients ?? []).filter(Boolean),
            description: draft.description.trim() ? draft.description.trim() : null,
            calories: draft.calories ? Number(draft.calories) : null,
            status: draft.status,
        };
    }, [draft]);

    /**
     * Senior-grade: isolated image flow returns confirmed item (fresh backend state)
     */
    const doImageFlow = useCallback(
        async (itemId: string): Promise<MenuItem | null> => {
            if (!draft.imageFile) return null;
            if (!onPresignImage) throw new Error("Missing onPresignImage prop");

            setStep("presigning");
            const presigned = await onPresignImage(itemId);
            const upload = presigned?.upload;

            if (!upload?.uploadUrl || !upload?.objectKey) {
                throw new Error("Presign did not return uploadUrl/objectKey");
            }

            setStep("uploading");
            await uploadToR2(upload.uploadUrl, draft.imageFile);

            setStep("confirming");
            const confirmed = await onConfirmImage(itemId, upload.objectKey);

            const newUrl = confirmed.imageUrl
                ? `${confirmed.imageUrl}${confirmed.imageUrl.includes("?") ? "&" : "?"}v=${Date.now()}`
                : "";

            setDraft((d) => ({
                ...d,
                imageFile: null,
                imagePreview: newUrl,
            }));

            return confirmed;
        },
        [draft.imageFile, onConfirmImage, onPresignImage]
    );

    const save = useCallback(async () => {
        setTouched(true);
        if (!isValid()) return;

        if (!menuId) {
            toast("menuId is missing");
            return;
        }

        try {
            setStep("saving");
            const basePayload = buildBasePayload();

            // EDIT
            if (item) {
                const updated = await onUpdate(item.id, basePayload);
                const confirmed = await doImageFlow(item.id);

                // Prefer latest server state
                const _finalItem = confirmed ?? updated;

                toast("Item updated");
                onClose();
                return;
            }

            // CREATE
            const created = await onCreate(basePayload);

            // ✅ keep your log EXACTLY as you want
            console.log("create response:", created);

            if (!created?.id) {
                throw new Error("Create did not return a valid item id");
            }

            await doImageFlow(created.id);

            toast(draft.imageFile ? "Item created with image" : "Item created");
            onClose();
        } catch (e: any) {
            toast(e?.response?.data?.message || e?.message || "Failed to save item");
        } finally {
            setStep("idle");
        }
    }, [
        buildBasePayload,
        doImageFlow,
        draft.imageFile,
        isValid,
        item,
        menuId,
        onClose,
        onCreate,
        onUpdate,
        toast,
    ]);

    const handleIngredientKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
                e.preventDefault();
                addIngredient();
            }
        },
        [addIngredient]
    );

    const statusText =
        step === "saving"
            ? "Saving..."
            : step === "presigning"
                ? "Preparing upload..."
                : step === "uploading"
                    ? "Uploading image..."
                    : step === "confirming"
                        ? "Confirming image..."
                        : "";

    return (
        <Modal open={open} onClose={onClose}>
            <ModalHeader title={item ? "Edit item" : "Create item"} onClose={onClose}/>

            <div className="space-y-6 pr-0">
                <div className="grid gap-4 md:grid-cols-2">
                    <Input
                        label="Name"
                        value={draft.name}
                        onChange={(e) => setDraft({...draft, name: e.target.value})}
                        error={touched && !draft.name.trim() ? "Required" : undefined}
                    />

                    <FormSelect
                        label="Category"
                        value={draft.categoryId}
                        onChange={(e) => setDraft({...draft, categoryId: e.target.value})}
                        error={touched && !draft.categoryId ? "Required" : undefined}
                    >
                        {categories.length === 0 ? (
                            <option value="">No categories found</option>
                        ) : (
                            categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))
                        )}
                    </FormSelect>

                    <Input
                        label="Price ($)"
                        value={draft.price}
                        onChange={(e) => {
                            const next = formatMoneyInput(e.target.value);
                            if (next !== null) setDraft({...draft, price: next});
                        }}
                        error={
                            touched && (!draft.price || Number.isNaN(Number(draft.price)) || Number(draft.price) < 0)
                                ? "Invalid"
                                : undefined
                        }
                    />

                    <Input
                        label="Calories"
                        value={draft.calories}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (/^\d*$/.test(v)) setDraft({...draft, calories: v});
                        }}
                        error={
                            touched &&
                            draft.calories &&
                            (Number.isNaN(Number(draft.calories)) || Number(draft.calories) < 0)
                                ? "Invalid"
                                : undefined
                        }
                    />
                </div>

                <FormSelect
                    label="Status"
                    value={draft.status}
                    onChange={(e) => setDraft({...draft, status: e.target.value as Draft["status"]})}
                >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="UNAVAILABLE">UNAVAILABLE</option>
                </FormSelect>

                <textarea
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:ring-brand focus:border-brand-dark"
                    rows={3}
                    placeholder="Description"
                    value={draft.description}
                    onChange={(e) => setDraft({...draft, description: e.target.value})}
                />

                {/* Image Upload */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Item Image</label>

                    <input
                        type="file"
                        accept="image/*"
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        onChange={(e) => {
                            const file = e.target.files?.[0] || null;

                            if (file && !file.type.startsWith("image/")) {
                                toast("Please select an image file");
                                return;
                            }
                            if (file && file.size > 8 * 1024 * 1024) {
                                toast("Image too large (max 8MB)");
                                return;
                            }

                            setDraft((d) => ({
                                ...d,
                                imageFile: file,
                                imagePreview: file ? URL.createObjectURL(file) : item?.imageUrl ?? "",
                            }));

                            setImgOk(true);

                            if (file && !onPresignImage) {
                                toast("Image upload is not configured (missing onPresignImage)");
                            }
                        }}
                    />

                    {!!draft.imagePreview && (
                        <img
                            src={draft.imagePreview}
                            alt="preview"
                            className="h-40 w-full rounded-xl object-cover"
                            onError={() => setImgOk(false)}
                            onLoad={() => setImgOk(true)}
                        />
                    )}

                    {!!draft.imagePreview && !imgOk && (
                        <p className="text-xs text-gray-500">Image failed to load. Try a different file.</p>
                    )}

                    {item?.imageUrl && !draft.imageFile && (
                        <p className="text-xs text-gray-500">Current image will stay unless you select a new file.</p>
                    )}

                    {draft.imageFile && !onPresignImage && (
                        <p className="text-xs text-red-600">Image upload not available: onPresignImage prop is
                            missing.</p>
                    )}
                </div>

                {/* Ingredients */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Ingredients</label>

                    <div className="flex gap-2">
                        <input
                            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-brand focus:border-brand-dark"
                            placeholder="Add ingredient"
                            value={draft.ingredientInput}
                            onChange={(e) => setDraft({...draft, ingredientInput: e.target.value})}
                            onKeyDown={handleIngredientKeyDown}
                        />
                        <Button type="button" onClick={addIngredient} disabled={!draft.ingredientInput.trim()}>
                            Add
                        </Button>
                    </div>

                    {touched && (draft.ingredients ?? []).length === 0 && (
                        <p className="text-xs text-red-600">At least 1 ingredient required</p>
                    )}

                    {(draft.ingredients ?? []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {draft.ingredients.map((ing) => (
                                <span
                                    key={ing}
                                    className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm"
                                >
                  {ing}
                                    <button
                                        type="button"
                                        onClick={() => removeIngredient(ing)}
                                        className="ml-1 text-gray-500"
                                        aria-label={`Remove ${ing}`}
                                    >
                    ×
                  </button>
                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4">
                    <div className="text-xs text-gray-500">{statusText}</div>

                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={onClose} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button onClick={save} isLoading={submitting} disabled={!isValid() || submitting}>
                            {item ? "Save" : "Create"}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
