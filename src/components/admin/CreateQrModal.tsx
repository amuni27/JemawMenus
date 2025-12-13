import { useState } from 'react';
import Button from '../../components/ui/Button';

interface Props {
  onCreate: (name: string, type: 'Menu' | 'Deal' | 'Ad') => void;
  onClose: () => void;
}

export default function CreateQrModal({ onCreate, onClose }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'Menu' | 'Deal' | 'Ad'>('Menu');
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Create QR</h2>
        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="Menu">Menu</option>
            <option value="Deal">Deal</option>
            <option value="Ad">Ad</option>
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => { onCreate(name, type); onClose(); }}>Create</Button>
        </div>
      </div>
    </div>
  );
}
