import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import { useFieldErrors } from "../../utils/fieldErrors";
import { displayCurrency } from "../../utils/currency";
import { ALLOWED_IMAGE_TYPES, imageFileProblem } from "../../utils/imagePolicy";
import Modal from "../ui/Modal.tsx";
import ModalHeader from "../ui/ModalHeader.tsx";
import Button from "../ui/Button.tsx";
import {Input} from "../ui/Input.tsx";
import {FormSelect} from "../form/FormSelect.tsx";
import type {MenuItem, Category, CreateItemPayload, ItemStatus} from "../../types/menu.ts";
import {useToast} from "../ui/ToastContext.tsx";
import {uploadToR2} from "../../utils/r2Service.ts";
import PillInput from "./PillInput.tsx";
import {SPICE_LEVELS} from "../../utils/spiceLevel.ts";
import {DIETARY_TAG_SUGGESTIONS} from "../../utils/dietary.ts";

// What each status means for guests (AGF-S1-12)
const STATUS_HELP: Record<ItemStatus, string> = {
    AVAILABLE: "Guests can see and add this item.",
    OUT_OF_STOCK: "Guests see this item marked Sold Out and cannot add it.",
    UNAVAILABLE: "Hidden from guests.",
};

type UploadInfo = { uploadUrl: string; objectKey: string; expiresInSeconds?: number };
type PresignResponse = { item: MenuItem; upload?: UploadInfo | null };

interface Props {
    /** The restaurant's currency, shown in the price label (AGF-S2-02) */
    currency?: string;
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
    onPresignImage?: (itemId: string, contentType: string) => Promise<PresignResponse>;

    // AGF-S2-16: remove the item's photo (called after the field save)
    onRemoveImage?: (itemId: string) => Promise<MenuItem>;
}



type Draft = {
    name: string;
    description: string;
    price: string;
    calories: string;
    categoryId: string;
    status: ItemStatus;
    imageFile: File | null;
    imagePreview: string; // blob or public url
    removeImage: boolean; // AGF-S2-16: remove the current photo on Save
    ingredients: string[];
    ingredientInput: string;
    // AGF-S2-06: details guests see on the item page
    allergens: string[];
    tags: string[];
    spiceLevel: string; // "" = not set
    isFeatured: boolean;
    prepTime: string;   // whole minutes; "" = not set
};

const COMMON_ALLERGENS = ["gluten", "dairy", "eggs", "nuts", "peanuts", "soy", "fish", "shellfish", "sesame"] as const;

/** Stored list values as a clean array; older data may hold a comma-separated string (same reading as the guest page). */
function toStringList(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.map((x) => (x == null ? "" : String(x).trim())).filter(Boolean);
    if (typeof raw === "string") return raw.split(",").map((x) => x.trim()).filter(Boolean);
    return [];
}

/** Why a prep time can't be saved, or null (backend: whole minutes, @Min(0)) */
function prepTimeProblem(value: string): string | null {
    if (value.trim() === "") return null;
    const n = Number(value);
    if (Number.isNaN(n) || n < 0) return "Prep time must be 0 or more minutes";
    if (!Number.isInteger(n)) return "Use whole minutes";
    return null;
}

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
            removeImage: false,
            ingredients: normalizeIngredients((item as any).ingredients),
            ingredientInput: "",
            allergens: toStringList(item.allergens),
            tags: toStringList(item.tags),
            spiceLevel: item.spiceLevel ?? "",
            // owner responses call the flag "featured"
            isFeatured: Boolean(item.featured ?? item.isFeatured),
            prepTime: item.prepTimeMinutes != null ? String(item.prepTimeMinutes) : "",
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
        removeImage: false,
        ingredients: [],
        ingredientInput: "",
        allergens: [],
        tags: [],
        spiceLevel: "",
        isFeatured: false,
        prepTime: "",
    };
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
                                      onRemoveImage,
                                      currency,
                                  }: Props) {
    const toast = useToast();
    const serverErrors = useFieldErrors(); // AGF-S2-11
    const clearServerErrors = serverErrors.clear;
    const applyServerErrors = serverErrors.apply;

    // AGF-S2-34: always update with setDraft((d) => ...). A handler that writes back the copy from its render can
    // overwrite changes made since then, e.g. the default category set when the form opens (defect F1).
    const [draft, setDraft] = useState<Draft>(() => buildDraft(item, categories));
    const [touched, setTouched] = useState(false);

    // Step state is senior-grade UX (clear progress & debugging)
    const [step, setStep] = useState<"idle" | "saving" | "presigning" | "uploading" | "confirming">(
        "idle"
    );
    const submitting = step !== "idle";

    const [imgOk, setImgOk] = useState(true);

    // AGF-S2-16: focus Undo after "Remove image", and the Remove button again after Undo
    const [removeError, setRemoveError] = useState("");
    const [focusTarget, setFocusTarget] = useState<"undo" | "remove" | null>(null);
    const undoRef = useRef<HTMLButtonElement>(null);
    const removeRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (focusTarget === "undo") undoRef.current?.focus();
        if (focusTarget === "remove") removeRef.current?.focus();
        if (focusTarget) setFocusTarget(null);
    }, [focusTarget]);

    const defaultCategoryId = useMemo(() => categories?.[0]?.id ?? "", [categories]);

    // Reset when modal opens
    useEffect(() => {
        if (!open) return;
        setDraft(buildDraft(item, categories));
        setTouched(false);
        clearServerErrors();
        setStep("idle");
        setImgOk(true);
        setRemoveError("");
    }, [open, item, categories, clearServerErrors]);

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

        if (prepTimeProblem(draft.prepTime)) return false;

        // If user selected image, require presign hook
        if (draft.imageFile && !onPresignImage) return false;

        return true;
    }, [draft, onPresignImage]);

    const buildBasePayload = useCallback((): CreateItemPayload => {
        const priceNum = Number(draft.price);

        // AGF-S2-06: on edit, send a detail field only when the owner changed it, so existing values stay as stored
        const loaded = item ? buildDraft(item, categories) : null;
        const details: Partial<CreateItemPayload> = {};
        const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
        if (!loaded || !sameList(draft.allergens, loaded.allergens)) details.allergens = draft.allergens;
        if (!loaded || !sameList(draft.tags, loaded.tags)) details.tags = draft.tags;
        // AGF-S2-30: unchanged → not sent; new value → sent; emptied on edit → explicit clear flag
        if (!loaded || draft.spiceLevel !== loaded.spiceLevel) {
            if (loaded && draft.spiceLevel === "") details.clearSpiceLevel = true;
            else details.spiceLevel = draft.spiceLevel || null;
        }
        if (!loaded || draft.isFeatured !== loaded.isFeatured) details.isFeatured = draft.isFeatured;
        if (!loaded || draft.prepTime !== loaded.prepTime) {
            if (draft.prepTime !== "") details.prepTimeMinutes = Number(draft.prepTime);
            else if (loaded) details.clearPrepTime = true;
        }

        return {
            name: draft.name.trim(),
            price: priceNum,
            categoryId: draft.categoryId,
            ingredients: (draft.ingredients ?? []).filter(Boolean),
            description: draft.description.trim() ? draft.description.trim() : null,
            calories: draft.calories ? Number(draft.calories) : null,
            status: draft.status,
            ...details,
        };
    }, [draft, item, categories]);

    /**
     * Senior-grade: isolated image flow returns confirmed item (fresh backend state)
     */
    const doImageFlow = useCallback(
        async (itemId: string): Promise<MenuItem | null> => {
            if (!draft.imageFile) return null;
            if (!onPresignImage) throw new Error("Missing onPresignImage prop");

            setStep("presigning");
            const presigned = await onPresignImage(itemId, draft.imageFile.type);
            const upload = presigned?.upload;

            if (!upload?.uploadUrl || !upload?.objectKey) {
                throw new Error("Presign did not return uploadUrl/objectKey");
            }

            setStep("uploading");
            await uploadToR2(upload.uploadUrl, draft.imageFile);

            setStep("confirming");
            const confirmed = await onConfirmImage(itemId, upload.objectKey);

            setDraft((d) => ({
                ...d,
                imageFile: null,
                imagePreview: confirmed.imageUrl ?? "",
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
                await onUpdate(item.id, basePayload);
                await doImageFlow(item.id);

                // AGF-S2-16: the fields are saved; a failed removal is reported without a false success
                if (draft.removeImage && !draft.imageFile && onRemoveImage) {
                    try {
                        await onRemoveImage(item.id);
                    } catch {
                        setRemoveError("Your changes were saved, but the image couldn't be removed. Try again.");
                        return;
                    }
                }

                toast("Item updated");
                onClose();
                return;
            }

            // CREATE
            const created = await onCreate(basePayload);

            if (!created?.id) {
                throw new Error("Create did not return a valid item id");
            }

            await doImageFlow(created.id);

            toast(draft.imageFile ? "Item created with image" : "Item created");
            onClose();
        } catch (e: any) {
            // AGF-S2-11: field errors go under their fields; anything else keeps the server message
            const banner = applyServerErrors(e, {
                name: draft.name, categoryId: draft.categoryId, price: draft.price, calories: draft.calories,
                description: draft.description, ingredients: draft.ingredients,
                allergens: draft.allergens, tags: draft.tags, spiceLevel: draft.spiceLevel,
                isFeatured: draft.isFeatured, prepTimeMinutes: draft.prepTime,
            }, "Failed to save item");
            if (banner) toast(banner);
        } finally {
            setStep("idle");
        }
    }, [
        applyServerErrors,
        buildBasePayload,
        doImageFlow,
        draft,
        isValid,
        item,
        menuId,
        onClose,
        onCreate,
        onRemoveImage,
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
                        onChange={(e) => { const name = e.target.value; setDraft((d) => ({...d, name})); }}
                        error={(touched && !draft.name.trim() ? "Required" : undefined) ?? serverErrors.errorFor("name", draft.name)}
                    />

                    <FormSelect
                        label="Category"
                        value={draft.categoryId}
                        onChange={(e) => { const categoryId = e.target.value; setDraft((d) => ({...d, categoryId})); }}
                        error={(touched && !draft.categoryId ? "Required" : undefined) ?? serverErrors.errorFor("categoryId", draft.categoryId)}
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
                        label={`Price (${displayCurrency(currency)})`}
                        value={draft.price}
                        onChange={(e) => {
                            const next = formatMoneyInput(e.target.value);
                            if (next !== null) setDraft((d) => ({...d, price: next}));
                        }}
                        error={
                            (touched && (!draft.price || Number.isNaN(Number(draft.price)) || Number(draft.price) < 0)
                                ? "Invalid"
                                : undefined) ?? serverErrors.errorFor("price", draft.price)
                        }
                    />

                    <Input
                        label="Calories"
                        value={draft.calories}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (/^\d*$/.test(v)) setDraft((d) => ({...d, calories: v}));
                        }}
                        error={
                            (touched &&
                            draft.calories &&
                            (Number.isNaN(Number(draft.calories)) || Number(draft.calories) < 0)
                                ? "Invalid"
                                : undefined) ?? serverErrors.errorFor("calories", draft.calories)
                        }
                    />
                </div>

                <FormSelect
                    label="Status"
                    value={draft.status}
                    onChange={(e) => { const status = e.target.value as Draft["status"]; setDraft((d) => ({...d, status})); }}
                >
                    <option value="AVAILABLE">Available</option>
                    <option value="OUT_OF_STOCK">Out of stock — shown to guests as Sold Out</option>
                    <option value="UNAVAILABLE">Unavailable — hidden from guests</option>
                </FormSelect>
                <p className="-mt-2 text-xs text-gray-500">{STATUS_HELP[draft.status]}</p>

                <textarea
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:ring-brand focus:border-brand-dark"
                    rows={3}
                    placeholder="Description"
                    value={draft.description}
                    onChange={(e) => { const description = e.target.value; setDraft((d) => ({...d, description})); }}
                />
                {serverErrors.errorFor("description", draft.description) && (
                    <p className="-mt-2 text-xs text-red-600">{serverErrors.errorFor("description", draft.description)}</p>
                )}

                {/* Image Upload */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Item Image</label>

                    <input
                        type="file"
                        accept={ALLOWED_IMAGE_TYPES.join(",")}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        onChange={(e) => {
                            const file = e.target.files?.[0] || null;

                            // Same rules as the backend (AGF-S1-17): JPEG, PNG or WebP, max 8 MB
                            const problem = file ? imageFileProblem(file) : null;
                            if (problem) {
                                toast(problem);
                                e.target.value = "";
                                return;
                            }

                            setDraft((d) => ({
                                ...d,
                                imageFile: file,
                                imagePreview: file ? URL.createObjectURL(file) : item?.imageUrl ?? "",
                                // a new file replaces the photo instead of removing it (AGF-S2-16)
                                removeImage: file ? false : d.removeImage,
                            }));
                            if (file) setRemoveError("");

                            setImgOk(true);

                            if (file && !onPresignImage) {
                                toast("Image upload is not configured (missing onPresignImage)");
                            }
                        }}
                    />

                    {!!draft.imagePreview && !draft.removeImage && (
                        <img
                            src={draft.imagePreview}
                            alt="preview"
                            className="h-40 w-full rounded-xl object-cover"
                            onError={() => setImgOk(false)}
                            onLoad={() => setImgOk(true)}
                        />
                    )}

                    {!!draft.imagePreview && !draft.removeImage && !imgOk && (
                        <p className="text-xs text-gray-500">Image failed to load. Try a different file.</p>
                    )}

                    {item?.imageUrl && !draft.imageFile && onRemoveImage && !draft.removeImage && (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-gray-500">Choose a new file to replace the image, or remove it.</p>
                            <Button
                                ref={removeRef}
                                type="button"
                                variant="secondary"
                                disabled={submitting}
                                onClick={() => {
                                    setDraft((d) => ({...d, removeImage: true}));
                                    setFocusTarget("undo");
                                }}
                            >
                                Remove image
                            </Button>
                        </div>
                    )}

                    <div aria-live="polite">
                        {draft.removeImage && (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2">
                                <p className="text-xs text-gray-700">Image will be removed when you save.</p>
                                <Button
                                    ref={undoRef}
                                    type="button"
                                    variant="secondary"
                                    disabled={submitting}
                                    onClick={() => {
                                        setDraft((d) => ({...d, removeImage: false}));
                                        setRemoveError("");
                                        setFocusTarget("remove");
                                    }}
                                >
                                    Undo
                                </Button>
                            </div>
                        )}
                    </div>

                    {removeError && (
                        <p role="alert" className="text-xs text-red-600">{removeError}</p>
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
                            onChange={(e) => { const ingredientInput = e.target.value; setDraft((d) => ({...d, ingredientInput})); }}
                            onKeyDown={handleIngredientKeyDown}
                        />
                        <Button type="button" onClick={addIngredient} disabled={!draft.ingredientInput.trim()}>
                            Add
                        </Button>
                    </div>

                    {touched && (draft.ingredients ?? []).length === 0 && (
                        <p className="text-xs text-red-600">At least 1 ingredient required</p>
                    )}
                    {serverErrors.errorFor("ingredients", draft.ingredients) && (
                        <p className="text-xs text-red-600">{serverErrors.errorFor("ingredients", draft.ingredients)}</p>
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

                {/* AGF-S2-06: details shown to guests on the item page */}
                <PillInput
                    label="Allergens"
                    values={draft.allergens}
                    onChange={(allergens) => setDraft((d) => ({...d, allergens}))}
                    placeholder="Add allergen"
                    suggestions={COMMON_ALLERGENS}
                    hint="Guests can exclude dishes by declared allergen, so list every allergen the dish contains."
                />
                {serverErrors.errorFor("allergens", draft.allergens) && (
                    <p className="text-xs text-red-600">{serverErrors.errorFor("allergens", draft.allergens)}</p>
                )}

                <PillInput
                    label="Tags"
                    values={draft.tags}
                    onChange={(tags) => setDraft((d) => ({...d, tags}))}
                    placeholder="e.g. vegetarian, fasting, chef's pick"
                    suggestions={DIETARY_TAG_SUGGESTIONS}
                    hint="Guests can filter by vegetarian, vegan, fasting and gluten-free. Add each tag that applies; fasting doesn't add vegan or vegetarian."
                />
                {serverErrors.errorFor("tags", draft.tags) && (
                    <p className="text-xs text-red-600">{serverErrors.errorFor("tags", draft.tags)}</p>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                        <label htmlFor="item-spice-level" className="text-sm font-medium text-gray-700">Spice level</label>
                        <select
                            id="item-spice-level"
                            value={draft.spiceLevel}
                            onChange={(e) => setDraft((d) => ({...d, spiceLevel: e.target.value}))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-brand focus:border-brand-dark"
                        >
                            {/* A saved level can't be cleared through the API; "None" hides it from guests */}
                            <option value="">Not set</option>
                            {SPICE_LEVELS.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                            {draft.spiceLevel && !SPICE_LEVELS.some((s) => s.value === draft.spiceLevel) && (
                                <option value={draft.spiceLevel}>{draft.spiceLevel}</option>
                            )}
                        </select>
                        {serverErrors.errorFor("spiceLevel", draft.spiceLevel) && (
                            <p className="text-xs text-red-600">{serverErrors.errorFor("spiceLevel", draft.spiceLevel)}</p>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="item-prep-time" className="text-sm font-medium text-gray-700">Prep time (minutes)</label>
                        <input
                            id="item-prep-time"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            value={draft.prepTime}
                            onChange={(e) => setDraft((d) => ({...d, prepTime: e.target.value}))}
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-brand focus:border-brand-dark"
                        />
                        {(prepTimeProblem(draft.prepTime) ?? serverErrors.errorFor("prepTimeMinutes", draft.prepTime)) && (
                            <p className="text-xs text-red-600">
                                {prepTimeProblem(draft.prepTime) ?? serverErrors.errorFor("prepTimeMinutes", draft.prepTime)}
                            </p>
                        )}
                    </div>
                </div>

                <label className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                        type="checkbox"
                        checked={draft.isFeatured}
                        onChange={(e) => setDraft((d) => ({...d, isFeatured: e.target.checked}))}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                    />
                    <span>
                        <span className="font-medium">Featured item</span>
                        <span className="block text-xs text-gray-500">Mark this as one of your highlights.</span>
                    </span>
                </label>

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
