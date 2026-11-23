import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';

// AGF EX-F (register §91, PO F-2): the Exceptions link with the number of unresolved exceptions (each record once), refreshed
// every 60 s while the console is open. No badge at zero or when the count can't be read (the page itself reports errors).

export const SUMMARY_REFRESH_MS = 60_000;

export default function ExceptionsNavLink({ className }: { className: (s: { isActive: boolean }) => string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => adminApi.exceptionSummary().then((res) => alive && setCount(res.data.unresolved ?? 0), () => alive && setCount(0));
    void load();
    const timer = setInterval(() => void load(), SUMMARY_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <NavLink to="/super-admin/exceptions" className={className} aria-label={count > 0 ? `Exceptions, ${count} unresolved` : undefined}>
      Exceptions
      {count > 0 && (
        <span aria-hidden="true" className="ml-2 inline-block rounded-full bg-red-700 px-2 py-0.5 text-xs font-semibold text-white">{count}</span>
      )}
    </NavLink>
  );
}
