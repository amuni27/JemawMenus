import { useState } from 'react';
import { useItems } from '../hooks/useItems';
import ItemCard from './ItemCard';
import ItemModal from './ItemModal';
import { useCategories } from '../hooks/useCategories';
import { MenuItem } from '../../../types/menu';

interface Props {
  menuId?: string;
}

export default function ItemGrid({ menuId }: Props) {
  const { items, toggleStatus } = useItems(menuId);
  const { categories } = useCategories(menuId);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | undefined>();

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search items"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:ring-brand/50"
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No items found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={() => openEdit(item)}
              onToggle={() => toggleStatus(item.id)}
            />
          ))}
        </div>
      )}

      <ItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        menuId={menuId}
        item={editing}
        categories={categories}
      />
    </div>
  );
}
