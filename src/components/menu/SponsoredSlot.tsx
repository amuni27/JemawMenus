import { useId } from "react";
import { ExternalLink } from "lucide-react";
import type { GuestLang } from "../../utils/guestLanguage";

// AGF E4-M7 (C1, C2): the one sponsored ad in a guest menu (Agafari ads on Model 2, restaurant ads on Model 3, E4-M8), after
// Specials and before the categories. Labelled by guest language; Amharic text when chosen and present (falls back to
// English); a new-tab link marked sponsored; no scripts or cookies; the link goes straight to the advertiser (no redirect).
// AD "Visit advertiser" (PO-approved): the whole card stays one link and shows a visible "Visit advertiser" cue with an
// external-link icon; the link is named by the title and the cue (plus a new-tab note), and described by the ad text.
// Without a valid https destination the card shows its text without a link.

export type SponsoredAd = {
    adId: string; title: string; body: string; titleAm?: string | null; bodyAm?: string | null; linkUrl: string;
    imageUrl?: string | null; imageAlt?: string | null;
};

const SPONSORED_LABEL: Record<GuestLang, string> = { en: "Sponsored", am: "የተደገፈ ማስታወቂያ" };
const VISIT_LABEL: Record<GuestLang, string> = { en: "Visit advertiser", am: "የማስታወቂያ አቅራቢውን ይጎብኙ" };

/** The destination only when it is an https URL with a host (the backend already guarantees this; defensive). */
function httpsDestination(link?: string | null): string | null {
    if (!link) return null;
    try {
        const url = new URL(link);
        return url.protocol === "https:" && url.hostname ? link : null;
    } catch {
        return null;
    }
}

export default function SponsoredSlot({ ad, lang }: { ad?: SponsoredAd | null; lang: GuestLang }) {
    const labelId = useId();
    const titleId = useId();
    const bodyId = useId();
    const visitId = useId();
    if (!ad) return null;
    const title = lang === "am" && ad.titleAm ? ad.titleAm : ad.title;
    const body = lang === "am" && ad.bodyAm ? ad.bodyAm : ad.body;
    const href = httpsDestination(ad.linkUrl);
    const image = ad.imageUrl && <img src={ad.imageUrl} alt={ad.imageAlt ?? ""} className="h-16 w-16 flex-none rounded-lg object-cover" loading="lazy" />;
    return (
        // AD-D1: in the menu column like Specials and Chef's picks (no extra side inset), same spacing before the next section
        <section role="region" aria-labelledby={labelId} className="mb-10 sm:mb-12">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <p id={labelId} className="text-xs font-semibold uppercase tracking-wide text-gray-700">{SPONSORED_LABEL[lang]}</p>
                {href ? (
                    <a href={href} target="_blank" rel="sponsored noopener noreferrer" aria-labelledby={`${titleId} ${visitId}`} aria-describedby={bodyId}
                       className="group mt-2 flex gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2">
                        {image}
                        <span className="min-w-0">
                            <span id={titleId} className="block font-semibold text-gray-900 underline-offset-2 group-hover:underline">{title}</span>
                            <span id={bodyId} className="mt-1 block text-sm text-gray-700">{body}</span>
                            <span id={visitId} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 group-hover:text-emerald-800 group-hover:underline">
                                <span>{VISIT_LABEL[lang]}</span>
                                <ExternalLink aria-hidden="true" className="h-4 w-4" />
                                <span className="sr-only"> (opens in a new tab)</span>
                            </span>
                        </span>
                    </a>
                ) : (
                    <div className="mt-2 flex gap-3">
                        {image}
                        <span className="min-w-0">
                            <span className="block font-semibold text-gray-900">{title}</span>
                            <span className="mt-1 block text-sm text-gray-700">{body}</span>
                        </span>
                    </div>
                )}
            </div>
        </section>
    );
}
