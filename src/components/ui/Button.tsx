import { ComponentProps } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'danger';

// React 19: `ref` is an ordinary prop and reaches the <button> through ...rest (AGF-S2-16 focus handling)
interface ButtonProps extends ComponentProps<'button'> {
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
      'bg-brand-dark text-white hover:bg-rose-700 focus:ring-brand/50 disabled:bg-brand/40', // AGF D-8: 4.70:1 / 6.29:1 (WCAG AA)
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
