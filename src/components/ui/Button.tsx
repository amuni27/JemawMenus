import { ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: Variant;
  isLoading?: boolean;
}

export default function Button({
  variant = 'primary',
  className,
  isLoading,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variants: Record<Variant, string> = {
    primary:
      'bg-brand text-white hover:bg-brand-dark focus:ring-brand/50 disabled:bg-brand/40',
    secondary:
      'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-400 disabled:bg-gray-50',
    danger:
      'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-300',
  };
  return (
    <button
      className={clsx(base, variants[variant], className)}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? '...' : children}
    </button>
  );
}
