import { forwardRef, ComponentPropsWithoutRef } from "react";
import clsx from "clsx";

interface Props extends ComponentPropsWithoutRef<"select"> {
  label?: string;
  error?: string;
}

const baseClasses =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand-dark transition";

export const FormSelect = forwardRef<HTMLSelectElement, Props>(({ label, error, className, children, ...rest }, ref) => {
  return (
    <div className={clsx("space-y-1", className)}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <select ref={ref} className={baseClasses} {...rest}>
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});
FormSelect.displayName = "FormSelect";
