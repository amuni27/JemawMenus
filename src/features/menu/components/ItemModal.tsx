import React, { useEffect, useState } from "react";
import Modal from "../../../components/ui/Modal";
import ModalHeader from "../../../components/ui/ModalHeader";
import Button from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { FormSelect } from "../../../components/form/FormSelect";
import type { MenuItem, Category } from "../../../types/menu";
import { useItems } from "../hooks/useItems";
import { useToast } from "../../../components/ui/ToastContext";

interface Props {
  open: boolean;
  onClose: () => void;
  menuId?: string;
  item?: MenuItem; // edit mode if provided
  categories: Category[]; // ✅ pass from DB (useCategories(menuId) in parent)
}

type Draft = {
  name: string;
  description: string;
  price: string; // keep as string for input
  calories: string;
  categoryId: string;
  status: "AVAILABLE" | "UNAVAILABLE";
  imageUrl: string;
  ingredients: string[]; // ✅ matches backend (jsonb + z.array(z.string()))
  ingredientInput: string;
};

function buildDraft(item: MenuItem | undefined, categories: Category[]): Draft {
  if (item) {
    return {
      name: item.name ?? "",
      description: item.description ?? "",
      price: item.price != null ? String(item.price) : "",
      calories: item.calories != null ? String(item.calories) : "",
      categoryId: item.categoryId ?? categories[0]?.id ?? "",
      status: (item.status as any) ?? "AVAILABLE",
      imageUrl: item.imageUrl ?? "",
      ingredients: Array.isArray(item.ingredients) ? (item.ingredients as any as string[]) : [],
      ingredientInput: "",
    };
  }

  return {
    name: "",
    description: "",
    price: "",
    calories: "",
    categoryId: categories[0]?.id ?? "",
    status: "AVAILABLE",
    imageUrl: "",
    ingredients: [],
    ingredientInput: "",
  };
}

export default function ItemModal({ open, onClose, menuId, item, categories }: Props) {
  const toast = useToast();
  const { createItem, updateItem } = useItems(menuId);

  const [draft, setDraft] = useState<Draft>(() => buildDraft(item, categories));
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ✅ reset draft whenever modal opens / item changes / categories load
  useEffect(() => {
    if (!open) return;
    setDraft(buildDraft(item, categories));
    setTouched(false);
    setSubmitting(false);
  }, [open, item, categories]);

  // ✅ if creating and categories arrive later, set default category
  useEffect(() => {
    if (!open) return;
    if (!item && !draft.categoryId && categories.length > 0) {
      setDraft((d) => ({ ...d, categoryId: categories[0].id }));
    }
  }, [open, item, categories, draft.categoryId]);

  const addIngredient = () => {
    const val = draft.ingredientInput.trim();
    if (!val) return;

    if (draft.ingredients.some((ing) => ing.toLowerCase() === val.toLowerCase())) {
      setDraft((d) => ({ ...d, ingredientInput: "" }));
      return;
    }

    setDraft((d) => ({
      ...d,
      ingredients: [...d.ingredients, val],
      ingredientInput: "",
    }));
  };

  const removeIngredient = (ing: string) => {
    setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((i) => i !== ing) }));
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

    if (draft.ingredients.length === 0) return false;

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

      // ✅ payload aligned to backend createItemSchema
      // backend computes sortOrder; do NOT send it
      const payload = {
        name: draft.name.trim(),
        price: Number(draft.price),
        categoryId: draft.categoryId,
        ingredients: draft.ingredients, // ✅ jsonb array of strings
        description: draft.description.trim() ? draft.description.trim() : null,
        imageUrl: draft.imageUrl.trim() ? draft.imageUrl.trim() : null,
        calories: draft.calories ? Number(draft.calories) : null,
        status: draft.status,
      };

      if (item) {
        await updateItem(item.id, payload as any);
        toast("Item updated");
      } else {
        await createItem(payload as any);
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
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                error={
                  touched && (!draft.price || Number.isNaN(Number(draft.price)) || Number(draft.price) < 0)
                      ? "Invalid"
                      : undefined
                }
            />

            <Input
                label="Calories"
                value={draft.calories}
                onChange={(e) => setDraft({ ...draft, calories: e.target.value })}
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

          {/* Image URL & preview */}
          <div className="space-y-2">
            <Input
                label="Image URL"
                value={draft.imageUrl}
                onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
            />
            {draft.imageUrl.trim() && (
                <img
                    src={draft.imageUrl.trim()}
                    alt="preview"
                    className="h-40 w-full rounded-xl object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                    onLoad={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "block";
                    }}
                />
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

            {touched && draft.ingredients.length === 0 && (
                <p className="text-xs text-red-600">At least 1 ingredient required</p>
            )}

            {draft.ingredients.length > 0 && (
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
