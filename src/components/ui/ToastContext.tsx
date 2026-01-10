import { createContext, ReactNode, useContext, useState } from 'react';
import {Toast} from "./Toast.tsx";

interface ToastProps {
  id: string;
  message: string;
}

interface ToastContextValue {
  toasts: ToastProps[];
  show: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const show = (message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ toasts, show }}>
      {children}
      {/* viewport */}

      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
            <Toast show={true} message={t.message} />
          // <div
          //   key={t.id}
          //   className="rounded-lg bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg backdrop-blur"
          // >
          //   {t.message}
          // </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('ToastProvider missing');
  return ctx.show;
}
