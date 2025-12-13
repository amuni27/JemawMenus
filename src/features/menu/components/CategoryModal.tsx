import { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import ModalHeader from '../../../components/ui/ModalHeader';
import { Input } from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { Category } from '../../../types/menu';
import { useCategories } from '../hooks/useCategories';
import { useToast } from '../../../components/ui/ToastContext';

interface Props {
  open: boolean;
  onClose: () => void;
  menuId?: string;
  category?: Category; // if provided => edit mode
}

export default function CategoryModal({ open, onClose, menuId, category }: Props) {
  const { createCategory, updateCategory } = useCategories(menuId);
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const isValid = name.trim().length > 0;

  const save = async () => {
    setTouched(true);
    if (!isValid) return;
    setSubmitting(true);
    if (category) {
      await updateCategory(category.id, name.trim());
      toast('Category updated');
    } else {
      await createCategory(name.trim());
      toast('Category created');
    }
    setSubmitting(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title={category ? 'Rename category' : 'Create category'}
        onClose={onClose}
      />

      <div className="space-y-6">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={touched && !isValid ? 'Name is required' : undefined}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={save} isLoading={submitting} disabled={!isValid}>
            {category ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
