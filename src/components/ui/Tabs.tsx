import { ReactNode, useState } from 'react';
import clsx from 'clsx';

export interface Tab {
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultIndex?: number;
}

export default function Tabs({ tabs, defaultIndex = 0 }: TabsProps) {
  const [index, setIndex] = useState(defaultIndex);
  return (
    <div>
      <div className="mb-2 flex border-b">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            className={clsx(
              'px-4 py-2 text-sm font-medium',
              index === i
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-blue-600',
            )}
            onClick={() => setIndex(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{tabs[index].content}</div>
    </div>
  );
}
