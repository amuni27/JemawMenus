import { ItemStatus } from '../../../types/menu';
import clsx from 'clsx';

export default function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span
      className={clsx(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        status === 'AVAILABLE'
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-200 text-gray-600',
      )}
    >
      {status === 'AVAILABLE' ? 'Available' : 'Unavailable'}
    </span>
  );
}
