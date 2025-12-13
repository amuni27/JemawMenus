import { ReactNode } from 'react';
import clsx from 'clsx';
import { ComponentPropsWithoutRef } from 'react';

interface CardProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
}

export default function Card({ children, className, ...rest }: CardProps) {
  return (
    <div
      className={clsx('rounded-2xl border border-gray-200 bg-white p-6 shadow-sm', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
