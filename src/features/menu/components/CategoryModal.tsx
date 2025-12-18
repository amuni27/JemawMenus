import { useEffect, useState } from "react";
import Modal from "../../../components/ui/Modal";
import ModalHeader from "../../../components/ui/ModalHeader";
import { Input } from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { Category } from "../../../types/menu";
import { useCategories } from "../hooks/useCategories";
import { useToast } from "../../../components/ui/ToastContext";

interface Props {
  open: boolean;
  onClose: () => void;
  menuId?: string;
  category?: Category;
  onCreate: (name: string) => Promise<Category>;
  onUpdate: (categoryId: string, name: string) => Promise<Category>;
}

export default function CategoryModal({ open, onClose, menuId, category, onCreate, onUpdate }: Props) {
  const toast = useToast();

  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  // ✅ preload on open / when category changes
  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setTouched(false);
    setSubmitting(false);
  }, [open, category]);

  const isValid = name.trim().length > 0;

  const save = async () => {
    setTouched(true);
    if (!isValid) return;

    try {
      setSubmitting(true);

      if (category) {
        // ✅ rename
        await onUpdate(category.id, name.trim());
        toast("Category updated");
      } else {
        // ✅ create
        if (!menuId) throw new Error("menuId is required");
        await onCreate(name.trim());
        toast("Category created");
      }

      onClose();
    } catch (e: any) {
      toast(e?.message || "Failed to save category");
    } finally {
      setSubmitting(false);
    }
  };

  return (
      <Modal open={open} onClose={onClose}>
        <ModalHeader title={category ? "Rename category" : "Create category"} onClose={onClose} />

        <div className="space-y-6">
          <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={touched && !isValid ? "Name is required" : undefined}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={save} isLoading={submitting} disabled={!isValid || submitting}>
              {category ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
  );
}
