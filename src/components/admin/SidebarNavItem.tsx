import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

interface Props {
  to: string;
  label: string;
  exact?: boolean;
  icon?: React.ReactNode;
}

export default function SidebarNavItem({ to, label, exact, icon }: Props) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
          isActive ? 'bg-brand/10 text-brand' : 'text-gray-700 hover:bg-gray-100',
        )
      }
    >
      {icon && <span className="text-base">{icon}</span>}
      {label}
    </NavLink>
  );
}
