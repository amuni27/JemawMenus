import { createContext, useContext, useState, ReactNode } from 'react';
import { QrEntry } from '../types/dashboard';
import { nanoid } from 'nanoid';

interface QrContextValue {
  entries: QrEntry[];
  add: (data: Pick<QrEntry, 'name' | 'type'>) => void;
  updateStatus: (id: string, status: QrEntry['status']) => void;
}

const QrContext = createContext<QrContextValue | undefined>(undefined);

export function QrProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<QrEntry[]>([
    {
      id: '1',
      tenantId: 't1',
      name: 'Pizza Roma',
      shortLink: 'qrkit.co/b8T1J4',
      type: 'Menu',
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    },
  ]);

  const add = ({ name, type }: { name: string; type: 'Menu' | 'Deal' | 'Ad' }) => {
    const newEntry: QrEntry = {
      id: nanoid(),
      tenantId: 't1',
      name,
      shortLink: `qrkit.co/${nanoid(6)}`,
      type,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    };
    setEntries((prev) => [...prev, newEntry]);
  };

  const updateStatus = (id: string, status: QrEntry['status']) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status, updatedAt: new Date().toISOString() } : e)),
    );
  };

  return (
    <QrContext.Provider value={{ entries, add, updateStatus }}>{children}</QrContext.Provider>
  );
}

export const useQrStore = () => {
  const ctx = useContext(QrContext);
  if (!ctx) throw new Error('QrStore not available');
  return ctx;
};
