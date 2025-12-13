import { useState } from 'react';

interface Props {
  onRename: () => void;
  onPause: () => void;
  onTrash: () => void;
}

export default function KebabMenu({ onRename, onPause, onTrash }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="px-2" onClick={() => setOpen((o) => !o)}>
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-32 rounded-lg border bg-white shadow-lg text-sm z-20">
          <button className="block w-full px-3 py-2 text-left hover:bg-gray-100" onClick={onRename}>
            Rename
          </button>
          <button className="block w-full px-3 py-2 text-left hover:bg-gray-100" onClick={onPause}>
            Pause
          </button>
          <button className="block w-full px-3 py-2 text-left hover:bg-gray-100" onClick={onTrash}>
            Trash
          </button>
        </div>
      )}
    </div>
  );
}
