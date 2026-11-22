import type { OwnerNotice, OwnerPrice } from "../../api/planApi";
import { trialEndDate } from "../../utils/trialDate";
// AGF E4-M4: owner-facing plan wording. No prices, payments, trials or limits exist yet.
export const modelName = (code: string) => `Model ${code.slice(-1)}`;

export const PLAN_DESCRIPTIONS: Record<string, string> = {
    MODEL_1: "Free trial, then a paid subscription",
    MODEL_2: "Free, with Agafari ads",
    MODEL_3: "Paid, with your own ads on your menus",
    MODEL_4: "Lower-cost paid plan, no ads",
};

export const FEATURES_NOTE = "All features stay available while plans are being introduced.";

// ONB Phase 1 (ON-UX-5): customer-facing names; internal ids (MODEL_2…4) stay unchanged. Model 1 keeps its name (it is
// never offered as a choice, and a converted Model 1 subscription isn't a free trial).
export const PLAN_NAMES: Record<string, string> = { MODEL_2: "Free with Ads", MODEL_3: "Business Ads", MODEL_4: "Ad-Free" };
export const planName = (code: string) => PLAN_NAMES[code] ?? modelName(code);

// ONB Phase 1: only approved facts (R4–R6, E4-M7, E4-M8); no prices, billing terms or invented features
export const PLAN_BENEFITS: Record<string, string[]> = {
    MODEL_2: ["Free", "Agafari shows one sponsored item on your guest menu, chosen by Agafari", "Your menu, QR code and features stay the same"],
    MODEL_3: ["Paid", "Show your own sponsored items on your own menu, managed in Ads", "No Agafari ads; you keep your advertising revenue"],
    MODEL_4: ["Lower-cost paid plan", "No ads on your guest menu"],
};

export const PLAN_COMPARISON: { label: string; values: Record<string, string> }[] = [
    { label: "Ads on your guest menu", values: { MODEL_2: "One sponsored item", MODEL_3: "Your own sponsored items", MODEL_4: "None" } },
    { label: "Who chooses the ads", values: { MODEL_2: "Agafari", MODEL_3: "You", MODEL_4: "—" } },
    { label: "Cost", values: { MODEL_2: "Free", MODEL_3: "Paid", MODEL_4: "Lower-cost paid" } },
    { label: "Ads page to manage your own ads", values: { MODEL_2: "—", MODEL_3: "Yes", MODEL_4: "—" } },
];

export const PRICING_NOTE = "Pricing will be announced.";
export const ACTIVATION_NOTE = "Requesting a plan doesn't charge you; the Agafari team activates it.";
export const CHANGE_NOTE = "To change your plan, contact the Agafari team.";

// AGF E4-M5: in-app trial notices (emails wait for D5)
export const TRIAL_NOTICE_DAYS = 7;

// AGF FE-1: the owner-started free trial. Terms from the accepted trial policy only: 30 days (E4-Q2a), no charge and no
// payment details, one trial per restaurant (D-M5-2), the Agafari team follows up (E4-M5). Owner-facing refusal wording
// by the backend's BE-1 codes; a code not listed here shows the server's own message.
export const TRIAL_DAYS = 30;
export const TRIAL_TERMS = [
    `Try Agafari free for ${TRIAL_DAYS} days.`,
    "No payment details and no charge.",
    "One free trial per restaurant.",
    "Before it ends, the Agafari team will contact you about your plan.",
];
export const TRIAL_REFUSALS: Record<string, string> = {
    CONFIG_VERSION_CONFLICT: "The available plans changed. We've updated this page; check it and try again.",
};
export const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

export const statusLabel = (status: string) => (status.charAt(0) + status.slice(1).toLowerCase()).replace(/_/g, " "); // PAST_DUE → "Past due"

// AGF FE-R1 (addendum §13 "Owner sees"): renewal wording and the card-update refusals
export const CARD_UPDATE_REFUSALS: Record<string, string> = {
    PORTAL_NOT_ELIGIBLE: "Card update isn't available for this plan.",
    PORTAL_UNAVAILABLE: "The card-update page is unavailable right now. Please try again.",
};
export const CARD_UPDATE_FAILED = "Couldn't open the card-update page. Please try again.";

/** An amount in minor units (e.g. cents), in its currency; empty when the backend sent none. */
export function money(amountMinor: number | null | undefined, currency: string | null | undefined): string {
    if (amountMinor == null || !currency) return "";
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountMinor / 100);
}

// AA contrast on white (the shared brand Button is below AA, a known deferred defect)
export const OWNER_PRIMARY = "rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400";
export const OWNER_SECONDARY = "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-50";

// AGF FE-R2 (backend R5-03-D): the wording of an owner notice, from its data (dates in the restaurant's time zone)
const noticeDay = (iso: string | undefined, zone: string | undefined) => (iso ? trialEndDate(iso, zone) : "");

export function noticeText(n: OwnerNotice): string {
    const d = n.data ?? {};
    const plan = d.planCode ? planName(d.planCode) : "your plan";
    const amount = money(d.amountMinor, d.currency);
    switch (n.kind) {
        case "RENEWAL_PAYMENT_REQUEST": {
            const by = d.graceUntil ? ` by ${noticeDay(d.graceUntil, d.timeZone)}` : "";
            const prefix = d.day === 6 ? "Last reminder: " : d.day === 3 ? "Reminder: " : "Your payment didn't go through. ";
            return `${prefix}Update your card${by} to keep ${plan}.`;
        }
        case "PAYMENT_RECEIVED":
            return `Payment received${amount ? `: ${amount}` : ""}. ${plan} continues${d.periodEnd ? ` until ${noticeDay(d.periodEnd, d.timeZone)}` : ""}.`;
        case "EXPIRY_NOTICE":
            return `${plan} ended${d.endedAt ? ` on ${noticeDay(d.endedAt, d.timeZone)}` : ""}. Choose a plan to continue.`;
        case "PLAN_ENDED_REFUND":
            return `${plan} had already ended${d.endedAt ? ` on ${noticeDay(d.endedAt, d.timeZone)}` : ""} when a payment${amount ? ` of ${amount}` : ""} was made. It will be refunded.`;
        default:
            return "You have a new notice.";
    }
}

// AGF F2 (register §84 D1): a paid plan's price as the backend lists it (amount, currency, interval); no tax wording (AD-16)
export const priceLine = (p: OwnerPrice) => `${money(p.amountMinor, p.currency)} per ${p.interval === "YEAR" ? "year" : "month"}`;
export const PRICE_TO_BE_ANNOUNCED = "Price to be announced";

// AGF F3 (register §84 D1, D4, D7): Subscribe wording and checkout refusals
// AGF F5 (register §87): a paid plan without checkout (billing off, not available, or no listed price); a status, never an action
export const PAYMENT_NOT_AVAILABLE = "Payment not available yet";
export const CHECKOUT_NOTE = "You'll pay securely on Stripe. Your plan starts once the payment is confirmed.";
export const CHECKOUT_FAILED = "Couldn't start the payment. Please try again.";
export const CHECKOUT_NOT_AVAILABLE = "Online payment isn't available right now.";
export const CHECKOUT_VERIFY = "Verify your email to subscribe to a paid plan.";
export const CHECKOUT_IN_PROGRESS = "You have a payment in progress.";
export const CHECKOUT_CANCELLED_NOTICE = "Payment cancelled. You weren't charged.";
// AGF F4 (register §84 D1, D5): the pages Stripe returns to; only the backend's verified plan view says a plan is active (P-7)
export const RETURN_CONFIRMING = "Confirming your payment…";
export const RETURN_ACTIVE = "Your plan is active.";
export const RETURN_REVIEW = "We're reviewing your payment. This can take up to two business days.";
export const RETURN_NOT_YET = "We haven't received a confirmation yet. If you paid, it will appear here; you can safely leave this page.";
export const RETURN_NO_CHECKOUT = "We couldn't find a payment started in this browser. Your plan's state is on Subscription & Plans.";
export const CANCEL_ALREADY_FINISHED = "This payment had already finished. Your plan's state is on Subscription & Plans.";
export const CHECKOUT_REFUSALS: Record<string, string> = {
    EMAIL_NOT_VERIFIED: CHECKOUT_VERIFY,
    PAYMENT_UNDER_REVIEW: "We're reviewing a payment for your restaurant. You can subscribe once it's resolved.",
    CHECKOUT_PLAN_CHANGE_UNAVAILABLE: CHANGE_NOTE,
    CHECKOUT_CONVERSION_UNAVAILABLE: CHANGE_NOTE,
    CHECKOUT_CANCELLED: "This payment was cancelled. Please try again.",
};
