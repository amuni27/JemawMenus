import { ItemStatus } from '../../types/menu.ts';
import clsx from 'clsx';

const LABELS: Record<ItemStatus, string> = {
  AVAILABLE: 'Available',
  OUT_OF_STOCK: 'Sold out',
  UNAVAILABLE: 'Unavailable',
};

export default function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span
      className={clsx(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        status === 'AVAILABLE' && 'bg-green-100 text-green-800',
        status === 'OUT_OF_STOCK' && 'bg-amber-100 text-amber-800',
        status === 'UNAVAILABLE' && 'bg-gray-200 text-gray-600',
      )}
    >
      {LABELS[status] ?? LABELS.UNAVAILABLE}
    </span>
  );
}
