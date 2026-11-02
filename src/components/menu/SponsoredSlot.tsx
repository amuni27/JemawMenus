import { useId } from "react";
import type { GuestLang } from "../../utils/guestLanguage";

// AGF E4-M7 (C1, C2): the one Agafari ad in a Model 2 restaurant's guest menu, after Specials and before the categories.
// Labelled by guest language; Amharic text when chosen and present (falls back to English); a new-tab link marked
// sponsored; no scripts or cookies; the link goes straight to the advertiser (no redirect).

export type SponsoredAd = {
    adId: string; title: string; body: string; titleAm?: string | null; bodyAm?: string | null; linkUrl: string;
    imageUrl?: string | null; imageAlt?: string | null;
};

const SPONSORED_LABEL: Record<GuestLang, string> = { en: "Sponsored", am: "የተደገፈ ማስታወቂያ" };

export default function SponsoredSlot({ ad, lang }: { ad?: SponsoredAd | null; lang: GuestLang }) {
    const labelId = useId();
    if (!ad) return null;
    const title = lang === "am" && ad.titleAm ? ad.titleAm : ad.title;
    const body = lang === "am" && ad.bodyAm ? ad.bodyAm : ad.body;
    return (
        // AD-D1: in the menu column like Specials and Chef's picks (no extra side inset), same spacing before the next section
        <section role="region" aria-labelledby={labelId} className="mb-10 sm:mb-12">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <p id={labelId} className="text-xs font-semibold uppercase tracking-wide text-gray-700">{SPONSORED_LABEL[lang]}</p>
                <a href={ad.linkUrl} target="_blank" rel="sponsored noopener noreferrer"
                   className="mt-2 flex gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
                    {ad.imageUrl && <img src={ad.imageUrl} alt={ad.imageAlt ?? ""} className="h-16 w-16 flex-none rounded-lg object-cover" loading="lazy" />}
                    <span className="min-w-0">
                        <span className="block font-semibold text-gray-900 underline-offset-2 hover:underline">{title}</span>
                        <span className="mt-1 block text-sm text-gray-700">{body}</span>
                    </span>
                </a>
            </div>
        </section>
    );
}
