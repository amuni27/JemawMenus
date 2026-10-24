import { useState } from "react";
import clsx from "clsx";
import { businessInitials } from "../../utils/initials";

interface Props {
  name?: string | null;
  logoUrl?: string | null;
  className?: string;
}

/**
 * The restaurant's logo, or its initials on a neutral badge when there is no logo or it fails to load
 * (AGF-S2-01). Never falls back to a third-party image.
 */
export default function BusinessLogo({ name, logoUrl, className }: Props) {
  // The URL that failed to load; a new URL is tried again
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (logoUrl && logoUrl !== failedUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name || "Restaurant"} logo`}
        className={clsx("shrink-0 rounded-lg bg-white object-contain", className)}
        onError={() => setFailedUrl(logoUrl)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "inline-flex shrink-0 select-none items-center justify-center rounded-lg bg-gray-100 font-bold text-gray-600",
        className
      )}
    >
      {businessInitials(name)}
    </span>
  );
}
