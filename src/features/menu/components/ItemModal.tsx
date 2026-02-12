import React, { useEffect, useState } from "react";
import Modal from "../../../components/ui/Modal";
import ModalHeader from "../../../components/ui/ModalHeader";
import Button from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { FormSelect } from "../../../components/form/FormSelect";
import type { MenuItem, Category } from "../../../types/menu";
import { useToast } from "../../../components/ui/ToastContext";

interface Props {
  open: boolean;
  onClose: () => void;
  menuId?: string;
  item?: MenuItem; // edit mode if provided
  categories: Category[];

  onCreate: (payload: any) => Promise<{
    item: MenuItem;
    upload?: { uploadUrl: string; objectKey: string; expiresInSeconds?: number } | null;
  }>;

  onUpdate: (itemId: string, patch: Partial<MenuItem>) => Promise<MenuItem>;

  onConfirmImage: (itemId: string, objectKey: string) => Promise<MenuItem>;

  onPresignImage?: (itemId: string) => Promise<{
    item: MenuItem;
    upload?: { uploadUrl: string; objectKey: string; expiresInSeconds?: number } | null;
  }>;
}

type Draft = {
  name: string;
  description: string;
  price: string;
  calories: string;
  categoryId: string;
  status: "AVAILABLE" | "UNAVAILABLE";
  imageFile: File | null;
  imagePreview: string;
  ingredients: string[];
  ingredientInput: string;
};

function normalizeIngredients(raw: any): string[] {
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

async function uploadToR2(uploadUrl: string, file: File) {
  // NOTE: PUT uploads usually require Content-Type to match what you signed.
  // Keep Content-Type, but ensure your R2 CORS allows PUT.
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  });

  if (!res.ok) {
    // Some R2 responses have empty body; still provide useful error
    let text = "";
    try {
      text = await res.text();
    } catch {
      // ignore
    }
    throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
  }
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
  const [submitting, setSubmitting] = useState(false);

  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    if (!open) return;
    setDraft(buildDraft(item, categories));
    setTouched(false);
    setSubmitting(false);
    setImgOk(true);
  }, [open, item, categories]);

  useEffect(() => {
    if (!open) return;
    if (!item && !draft.categoryId && categories.length > 0) {
      setDraft((d) => ({ ...d, categoryId: categories[0].id }));
    }
  }, [open, item, categories, draft.categoryId]);

  useEffect(() => {
    return () => {
      if (draft.imagePreview && draft.imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(draft.imagePreview);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addIngredient = () => {
    const val = (draft.ingredientInput ?? "").trim();
    if (!val) return;

    // ✅ Safe comparison (prevents toLowerCase crash)
    const exists = (draft.ingredients ?? []).some(
        (ing) => String(ing ?? "").toLowerCase() === val.toLowerCase()
    );

    if (exists) {
      setDraft((d) => ({ ...d, ingredientInput: "" }));
      return;
    }

    setDraft((d) => ({
      ...d,
      ingredients: [...(d.ingredients ?? []), val].filter((x) => x && x.trim().length > 0),
      ingredientInput: "",
    }));
  };

  const removeIngredient = (ing: string) => {
    setDraft((d) => ({
      ...d,
      ingredients: (d.ingredients ?? []).filter((i) => i !== ing),
    }));
  };

  const isValid = () => {
    if (!draft.name.trim()) return false;
    if (!draft.categoryId) return false;

    const priceNum = Number(draft.price);
    if (!draft.price || Number.isNaN(priceNum) || priceNum < 0) return false;

    if (draft.calories) {
      const calNum = Number(draft.calories);
      if (Number.isNaN(calNum) || calNum < 0) return false;
    }

    if ((draft.ingredients ?? []).length === 0) return false;

    return true;
  };

  const save = async () => {
    setTouched(true);
    if (!isValid()) return;

    if (!menuId) {
      toast("menuId is missing");
      return;
    }

    try {
      setSubmitting(true);

      const basePayload: any = {
        name: draft.name.trim(),
        price: draft.price.trim(),
        categoryId: draft.categoryId,
        ingredients: (draft.ingredients ?? []).filter(Boolean),
        description: draft.description.trim() ? draft.description.trim() : null,
        calories: draft.calories ? Number(draft.calories) : null,
        status: draft.status,
      };

      // ---------------- EDIT ----------------
      if (item) {
        await onUpdate(item.id, basePayload as any);

        if (draft.imageFile) {
          if (!onPresignImage) {
            throw new Error("Missing onPresignImage prop for edit image uploads");
          }

          const presigned = await onPresignImage(item.id);
          const upload = presigned.upload;

          if (!upload?.uploadUrl || !upload?.objectKey) {
            throw new Error("Presign did not return uploadUrl/objectKey");
          }

          await uploadToR2(upload.uploadUrl, draft.imageFile);
          await onConfirmImage(item.id, upload.objectKey);
        }

        toast("Item updated");
        onClose();
        return;
      }

      // ---------------- CREATE ----------------
      const createPayload = {
        ...basePayload,
        image: draft.imageFile
            ? { fileName: draft.imageFile.name, contentType: draft.imageFile.type || "image/jpeg" }
            : null,
      };

      const created = await onCreate(createPayload);

      if (draft.imageFile && created.upload?.uploadUrl && created.upload?.objectKey) {
        await uploadToR2(created.upload.uploadUrl, draft.imageFile);
        await onConfirmImage(created.item.id, created.upload.objectKey);
        toast("Item created with image");
      } else {
        toast("Item created");
      }

      onClose();
    } catch (e: any) {
      toast(e?.response?.data?.message || e?.message || "Failed to save item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleIngredientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addIngredient();
    }
  };

  return (
      <Modal open={open} onClose={onClose}>
        <ModalHeader title={item ? "Edit item" : "Create item"} onClose={onClose} />

        <div className="space-y-6 pr-0">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
                label="Name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                error={touched && !draft.name.trim() ? "Required" : undefined}
            />

            <FormSelect
                label="Category"
                value={draft.categoryId}
                onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
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
                  const v = e.target.value;
                  if (/^\d*\.?\d{0,2}$/.test(v)) setDraft({ ...draft, price: v });
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
                  if (/^\d*$/.test(v)) setDraft({ ...draft, calories: v });
                }}
                error={
                  touched && draft.calories && (Number.isNaN(Number(draft.calories)) || Number(draft.calories) < 0)
                      ? "Invalid"
                      : undefined
                }
            />
          </div>

          <FormSelect
              label="Status"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}
          >
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="UNAVAILABLE">UNAVAILABLE</option>
          </FormSelect>

          <textarea
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:ring-brand focus:border-brand-dark"
              rows={3}
              placeholder="Description"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
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

                  if (draft.imagePreview && draft.imagePreview.startsWith("blob:")) {
                    URL.revokeObjectURL(draft.imagePreview);
                  }

                  setDraft((d) => ({
                    ...d,
                    imageFile: file,
                    imagePreview: file ? URL.createObjectURL(file) : item?.imageUrl ?? "",
                  }));

                  setImgOk(true);
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
          </div>

          {/* Ingredients */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Ingredients</label>

            <div className="flex gap-2">
              <input
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-brand focus:border-brand-dark"
                  placeholder="Add ingredient"
                  value={draft.ingredientInput}
                  onChange={(e) => setDraft({ ...draft, ingredientInput: e.target.value })}
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

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={save} isLoading={submitting} disabled={!isValid() || submitting}>
              {item ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
  );
}
