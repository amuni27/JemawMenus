import { useEffect, useState } from "react";
import { useFieldErrors } from "../../utils/fieldErrors";
import Modal from "../ui/Modal.tsx";
import ModalHeader from "../ui/ModalHeader.tsx";
import { Input } from "../ui/Input.tsx";
import Button from "../ui/Button.tsx";
import { Category } from "../../types/menu.ts";
import { useCategories } from "../../hooks/useCategories.ts";
import { useToast } from "../ui/ToastContext.tsx";

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
  const serverErrors = useFieldErrors(); // AGF-S2-11
  const clearServerErrors = serverErrors.clear;

  // ✅ preload on open / when category changes
  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setTouched(false);
    setSubmitting(false);
    clearServerErrors();
  }, [open, category, clearServerErrors]);

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
    } catch (e) {
      // AGF-S2-11: name errors under the field; anything else keeps the server message (was Axios' generic text)
      const banner = serverErrors.apply(e, { name: name.trim() }, "Failed to save category");
      if (banner) toast(banner);
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
              error={(touched && !isValid ? "Name is required" : undefined) ?? serverErrors.errorFor("name", name.trim())}
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
