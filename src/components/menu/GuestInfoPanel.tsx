import { useEffect, useState } from "react";
import { Clock, MapPin, Phone } from "lucide-react";
import clsx from "clsx";
import { openingStatus, type DayHours } from "../../utils/openingHours";

export type GuestBusinessInfo = {
  open24_7?: boolean;
  hours?: DayHours[] | null;
  timeZone?: string | null;
  businessPhone?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
};

/** Re-evaluates "open now" every minute while the menu stays open. */
function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** "+251 11 000 0000" → "+251110000000"; null when there are no digits */
function telHref(phone?: string | null): string | null {
  const trimmed = (phone ?? "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  return `tel:${trimmed.startsWith("+") ? "+" : ""}${digits}`;
}

function addressLine(b: GuestBusinessInfo): string {
  const parts = [b.streetAddress, b.city, b.state].map((p) => (p ?? "").trim()).filter(Boolean);
  return parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i).join(", ");
}

/** AGF-S2-03: open/closed status, today's hours, call and map links under the guest header. */
export default function GuestInfoPanel({ business }: { business: GuestBusinessInfo }) {
  const now = useNow();
  const status = openingStatus(business, now);
  const tel = telHref(business.businessPhone);
  const address = addressLine(business);

  if (status.status === "unknown" && !tel && !address) return null;

  return (
    <section aria-label="Restaurant information" className="border-b bg-gray-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-2 text-sm text-gray-700">
        {status.status !== "unknown" && (
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden="true" className="h-4 w-4 text-gray-400" />
            <span
              className={clsx(
                "font-semibold",
                status.status === "open" ? "text-emerald-700" : "text-gray-900"
              )}
            >
              {status.label}
            </span>
            {status.today && <span className="text-gray-500">{status.today}</span>}
          </span>
        )}

        {tel && (
          <a href={tel} className="inline-flex items-center gap-1.5 font-medium text-gray-700 hover:text-gray-900 hover:underline">
            <Phone aria-hidden="true" className="h-4 w-4 text-gray-400" />
            <span className="sr-only">Call </span>
            {business.businessPhone!.trim()}
          </a>
        )}

        {address && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1.5 text-gray-700 hover:text-gray-900 hover:underline"
          >
            <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="truncate">{address}</span>
          </a>
        )}
      </div>
    </section>
  );
}
