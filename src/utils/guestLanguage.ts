// AGF-S2-23 (checkpoint B): the guest menu language (D-S2-23-2…4). The restaurant's existing text is the main text;
// Amharic is shown field by field where the owner added it. The guest's choice is remembered on the device (a
// per-viewer convenience: storage may be unavailable, which only means the choice isn't remembered).
import { createContext, useContext } from "react";

export type GuestLang = "en" | "am";

export const GUEST_LANGUAGE_KEY = "agafari:guest-language";

/** A remembered choice wins; otherwise an Amharic browser starts in Amharic; otherwise English. */
export function initialLanguage(stored: unknown, browserLanguage?: string | null): GuestLang {
    if (stored === "en" || stored === "am") return stored;
    return (browserLanguage ?? "").toLowerCase().startsWith("am") ? "am" : "en";
}

export function readStoredLanguage(): unknown {
    try {
        const raw = window.localStorage.getItem(GUEST_LANGUAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function storeLanguage(lang: GuestLang): void {
    try {
        window.localStorage.setItem(GUEST_LANGUAGE_KEY, JSON.stringify(lang));
    } catch {
        // storage disabled or full: the choice just isn't remembered
    }
}

/** The text to show and, for Amharic, its lang attribute; a missing translation falls back to the main text. */
export function localized(main: string | null | undefined, am: string | null | undefined, lang: GuestLang): { text: string; lang?: "am" } {
    const translation = am?.trim();
    if (lang === "am" && translation) return { text: translation, lang: "am" };
    return { text: main ?? "", lang: undefined };
}

type Named = { name?: string | null; nameAm?: string | null; descriptionAm?: string | null };
type MenuLike = Named & { categories?: (Named & { items?: Named[] | null })[] | null };

const filled = (x?: Named | null) => Boolean(x?.nameAm?.trim() || x?.descriptionAm?.trim());

/** True when any guest-visible menu, category or item has Amharic text (D-S2-23-3). */
export function hasAmharic(menus: MenuLike[] | null | undefined): boolean {
    return (menus ?? []).some((m) => filled(m) || (m.categories ?? []).some((c) => filled(c) || (c.items ?? []).some(filled)));
}

export type GuestLanguage = { lang: GuestLang; available: boolean; setLang: (lang: GuestLang) => void };

export const GuestLanguageContext = createContext<GuestLanguage>({ lang: "en", available: false, setLang: () => {} });

/** The selected language; English whenever the restaurant has no Amharic text. */
export function useGuestLanguage(): GuestLanguage {
    const ctx = useContext(GuestLanguageContext);
    return ctx.available ? ctx : { ...ctx, lang: "en" };
}

/** `t(main, am)` → text plus lang for the selected language. */
export function useLocalized() {
    const { lang } = useGuestLanguage();
    return (main: string | null | undefined, am: string | null | undefined) => localized(main, am, lang);
}
