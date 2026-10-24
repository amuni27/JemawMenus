import CategoryList from './CategoryList.tsx';
import {Category} from "../../types/menu.ts";

export interface CategoryPanelProps {
  menuId?: string;
  // state
  categories: Category[];
  loading: boolean;
  error?: string;

  // actions
  onCreate: (name: string) => Promise<Category>;
  onUpdate: (categoryId: string, name: string) => Promise<Category>;
  onDelete: (categoryId: string) => Promise<void>;
  onToggleActive?: (categoryId: string, active: boolean) => Promise<Category>;
  onMove?: (categoryId: string, direction: -1 | 1) => Promise<void>;
  onReorder?: (orderedIds: string[]) => Promise<void>;
}

export default function CategoryPanel({ menuId, categories, loading, error, onCreate, onUpdate, onDelete, onToggleActive, onMove, onReorder }: CategoryPanelProps) {

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 h-fit">
      <CategoryList
          menuId={menuId}
          categories={categories}
          loading={loading}
          error={error}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onToggleActive={onToggleActive}
          onMove={onMove}
          onReorder={onReorder}
      />
    </div>
  );
}
