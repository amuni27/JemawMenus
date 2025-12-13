import { useState } from 'react';
import Button from '../../../components/ui/Button';
import { Menu } from '../../../types/menu';
import { useMenus } from '../hooks/useMenus';
import QrModal from './QrModal';

import clsx from 'clsx';

interface Props {
  tenantId: string;
  tenantSlug: string;
  selected?: string;
  onSelect: (id: string) => void;
  className?: string;
}

export default function MenuSwitcher({ tenantId, tenantSlug, selected, onSelect, className }: Props) {
  const { menus, createMenu } = useMenus(tenantId);
  const [showQR, setShowQR] = useState<string | undefined>();

  const handleNew = async () => {
    const name = prompt('Menu name');
    if (!name) return;
    const menu = await createMenu({
      name,
      type: 'FOOD',
      description: '',
      currency: 'USD',
      isActive: true,
    } as any);
    if (menu) onSelect(menu.id);
  };

  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="rounded-lg border-gray-300 px-3 py-2 focus:border-rose-500 focus:ring-rose-400"
      >
        {menus.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <Button onClick={handleNew}>+ New Menu</Button>
      {selected && (
        <Button variant="secondary" onClick={() => setShowQR(selected)}>
          QR Code
        </Button>
      )}

      {showQR && (
        <QrModal url={`/${tenantSlug}/menu/${showQR}`} onClose={() => setShowQR(undefined)} />
      )}
    </div>
  );
}
