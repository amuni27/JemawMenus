import clsx from 'clsx';
import { QrStatus } from '../../types/dashboard';

export default function StatusPill({ status }: { status: QrStatus }) {
  const color =
    status === 'ACTIVE'
      ? 'bg-green-100 text-green-800'
      : status === 'PAUSED'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-gray-200 text-gray-600';
  return <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', color)}>{status.toLowerCase()}</span>;
}
