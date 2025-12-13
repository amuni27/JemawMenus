import ItemGrid from './ItemGrid';

interface Props {
  menuId?: string;
}

export default function ItemsPanel({ menuId }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      <ItemGrid menuId={menuId} />
    </div>
  );
}
