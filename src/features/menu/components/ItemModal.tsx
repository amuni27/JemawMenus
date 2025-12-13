import { useEffect, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import ModalHeader from '../../../components/ui/ModalHeader';
import Button from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { FormSelect } from '../../../components/form/FormSelect';
import { MenuItem, Category } from '../../../types/menu';
import { useItems } from '../hooks/useItems';
import { useToast } from '../../../components/ui/ToastContext';

interface Props {
  open: boolean;
  onClose: () => void;
  menuId?: string;
  item?: MenuItem;
  categories: Category[];
}

type Draft = {
  name: string;
  description: string;
  price: string; // keep as string for easier input
  calories: string;
  categoryId: string;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  imageUrl: string;
  ingredients: string[];
  ingredientInput: string;
};

export default function ItemModal({ open, onClose, menuId, item, categories }: Props) {
  const { createItem, updateItem } = useItems(menuId);
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() =>
    item
      ? {
          name: item.name,
          description: item.description || '',
          price: item.price.toString(),
          calories: item.calories?.toString() || '',
          categoryId: item.categoryId,
          status: item.status,
          imageUrl: item.imageUrl || '',
          ingredients: item.ingredients,
          ingredientInput: '',
        }
      : {
          name: '',
          description: '',
          price: '',
          calories: '',
          categoryId: categories[0]?.id || '',
          status: 'AVAILABLE',
          imageUrl: '',
          ingredients: [],
          ingredientInput: '',
        },
  );
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Live preview load when item prop changes
  useEffect(() => {
    if (!item) return;
    setDraft((d) => ({ ...d, imageUrl: item.imageUrl || '' }));
  }, [item]);

  const addIngredient = () => {
    const val = draft.ingredientInput.trim();
    if (!val) return;
    if (draft.ingredients.some((ing) => ing.toLowerCase() === val.toLowerCase())) {
      setDraft((d) => ({ ...d, ingredientInput: '' }));
      return;
    }
    setDraft((d) => ({ ...d, ingredients: [...d.ingredients, val], ingredientInput: '' }));
  };

  const removeIngredient = (ing: string) => {
    setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((i) => i !== ing) }));
  };

  const isValid = () => {
    if (!draft.name.trim()) return false;
    if (!draft.price || isNaN(Number(draft.price))) return false;
    if (!draft.categoryId) return false;
    if (draft.ingredients.length === 0) return false;
    if (draft.calories && isNaN(Number(draft.calories))) return false;
    return true;
  };

  const save = async () => {
    setTouched(true);
    if (!isValid()) return;
    setSubmitting(true);
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      price: Number(draft.price),
      calories: draft.calories ? Number(draft.calories) : undefined,
      categoryId: draft.categoryId,
      status: draft.status,
      imageUrl: draft.imageUrl.trim(),
      ingredients: draft.ingredients,
      sortOrder: 0,
      tags: [],
    };
    if (item) {
      await updateItem(item.id, payload);
      toast('Item updated');
    } else {
      await createItem(payload as any);
      toast('Item created');
    }
    setSubmitting(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addIngredient();
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title={item ? 'Edit item' : 'Create item'} onClose={onClose} />

      <div className="space-y-6 pr-0">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            error={touched && !draft.name.trim() ? 'Required' : undefined}
          />
          <FormSelect
            label="Category"
            value={draft.categoryId}
            onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
            error={touched && !draft.categoryId ? 'Required' : undefined}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </FormSelect>
          <Input
            label="Price ($)"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            error={touched && (!draft.price || isNaN(Number(draft.price))) ? 'Invalid' : undefined}
          />
          <Input
            label="Calories"
            value={draft.calories}
            onChange={(e) => setDraft({ ...draft, calories: e.target.value })}
            error={
              touched && draft.calories && isNaN(Number(draft.calories)) ? 'Invalid' : undefined
            }
          />
        </div>

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
          {draft.imageUrl && (
            <img src={draft.imageUrl} alt="preview" className="h-40 w-full object-cover rounded-xl" />
          )}
        </div>

        {/* Ingredients chips */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Ingredients</label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-brand focus:border-brand-dark"
              placeholder="Add ingredient"
              value={draft.ingredientInput}
              onChange={(e) => setDraft({ ...draft, ingredientInput: e.target.value })}
              onKeyDown={handleKeyDown}
            />
            <Button type="button" onClick={addIngredient} disabled={!draft.ingredientInput.trim()}>
              Add
            </Button>
          </div>
          {touched && draft.ingredients.length === 0 && (
            <p className="text-xs text-red-600">At least 1 ingredient required</p>
          )}
          {draft.ingredients.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {draft.ingredients.map((ing) => (
                <span
                  key={ing}
                  className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm"
                >
                  {ing}
                  <button onClick={() => removeIngredient(ing)} className="ml-1 text-gray-500">
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
          <Button onClick={save} isLoading={submitting} disabled={!isValid()}>
            {item ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
