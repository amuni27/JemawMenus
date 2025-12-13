import { forwardRef, ComponentPropsWithoutRef } from "react";
import clsx from "clsx";

interface Props extends ComponentPropsWithoutRef<"textarea"> {
  label?: string;
  error?: string;
}

const baseClasses =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand-dark transition";

export const FormTextarea = forwardRef<HTMLTextAreaElement, Props>(({ label, error, className, ...rest }, ref) => {
  return (
    <div className={clsx("space-y-1", className)}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <textarea ref={ref} className={clsx(baseClasses, "min-h-[120px]")} {...rest} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});
FormTextarea.displayName = "FormTextarea";
