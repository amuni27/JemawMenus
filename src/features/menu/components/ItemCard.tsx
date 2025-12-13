import StatusBadge from './StatusBadge';
import { MenuItem } from '../../../types/menu';

interface Props {
  item: MenuItem;
  onEdit: () => void;
  onToggle: () => void;
}

export default function ItemCard({ item, onEdit, onToggle }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white shadow transition hover:shadow-md">
      {item.imageUrl && (
        <img src={item.imageUrl} alt={item.name} className="h-32 w-full object-cover" />
      )}
      <div className="p-4 space-y-1">
        <h3 className="font-semibold">{item.name}</h3>
        <p className="text-sm text-gray-500">${item.price.toFixed(2)}</p>
        <StatusBadge status={item.status} />
      </div>
      <div className="absolute top-2 right-2 flex gap-1">
        <button
          onClick={onEdit}
          className="rounded bg-white/80 px-2 py-1 text-xs shadow hover:bg-white"
        >
          Edit
        </button>
        <button
          onClick={onToggle}
          className="rounded bg-white/80 px-2 py-1 text-xs shadow hover:bg-white"
        >
          {item.status === 'AVAILABLE' ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}
