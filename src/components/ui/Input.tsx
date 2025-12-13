import { ComponentPropsWithoutRef, forwardRef } from 'react';
import clsx from 'clsx';

type InputProps = ComponentPropsWithoutRef<'input'> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className={clsx('w-full', className)}>
        {label && <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>}
        <input
          ref={ref}
          className="w-full rounded-lg border border-gray-300 focus:border-gray-400 px-4 py-3 text-sm placeholder-gray-400 focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/50 transition-colors"
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';
