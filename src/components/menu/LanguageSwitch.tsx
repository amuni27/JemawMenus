import { clsx } from "../../utils/clsx";
import { useGuestLanguage, type GuestLang } from "../../utils/guestLanguage";

// AGF-S2-23 (checkpoint B): "English | አማርኛ" on the guest menu, only when the restaurant has Amharic text.
const OPTIONS: { lang: GuestLang; label: string; htmlLang?: string }[] = [
    { lang: "en", label: "English" },
    { lang: "am", label: "አማርኛ", htmlLang: "am" },
];

export function LanguageSwitch() {
    const { lang, available, setLang } = useGuestLanguage();
    if (!available) return null;
    return (
        <div role="group" aria-label="Menu language" className="inline-flex shrink-0 rounded-full bg-gray-100 p-0.5 text-xs font-semibold">
            {OPTIONS.map((o) => (
                <button
                    key={o.lang}
                    type="button"
                    lang={o.htmlLang}
                    aria-pressed={lang === o.lang}
                    onClick={() => setLang(o.lang)}
                    className={clsx(
                        "rounded-full px-2.5 py-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600",
                        lang === o.lang ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
