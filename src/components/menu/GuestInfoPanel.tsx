import { useNow } from "../../hooks/useNow";
import { Clock, MapPin, Navigation, Phone } from "lucide-react";
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
  /** AGF-S2-12: the stored, validated Google Maps link */
  locationUrl?: string | null;
};

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

  const directions = business.locationUrl?.trim() || null; // AGF-S2-12

  if (status.status === "unknown" && !tel && !address && !directions) return null;

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

        {/* AGF-S2-12 (D-S2-12-4): a saved link replaces the address search link; the address stays as text */}
        {address && directions && (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-gray-700">
            <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="truncate">{address}</span>
          </span>
        )}

        {directions && (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            <Navigation aria-hidden="true" className="h-4 w-4" />
            Get Directions
          </a>
        )}

        {address && !directions && (
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
