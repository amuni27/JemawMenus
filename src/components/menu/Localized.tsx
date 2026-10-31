import type { ReactNode } from "react";
import { GuestLanguageContext, useLocalized, type GuestLanguage } from "../../utils/guestLanguage";

// AGF-S2-23 (checkpoint B): the guest language provider and a localized text that is marked lang="am" when Amharic
// is shown (helpers and hooks live in utils/guestLanguage).

export function GuestLanguageProvider({ value, children }: { value: GuestLanguage; children: ReactNode }) {
    return <GuestLanguageContext.Provider value={value}>{children}</GuestLanguageContext.Provider>;
}

export function Localized({ main, am }: { main: string | null | undefined; am: string | null | undefined }) {
    const t = useLocalized()(main, am);
    return t.lang ? <span lang={t.lang}>{t.text}</span> : <>{t.text}</>;
}
