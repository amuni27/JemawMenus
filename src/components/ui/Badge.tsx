import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'gray' | 'blue' | 'green' | 'red';
  className?: string;
}

const colorMap = {
  gray: 'bg-gray-100 text-gray-800',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
};

export default function Badge({ children, color = 'gray', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        colorMap[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
