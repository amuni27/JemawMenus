import CategoryList from './CategoryList';

interface Props {
  menuId?: string;
  selectedId?: string;
  onSelect?: (id?: string) => void;
}

export default function CategoryPanel({ menuId }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 h-fit">
      <CategoryList menuId={menuId} />
    </div>
  );
}
