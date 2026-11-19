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

export const statusLabel = (status: string) => status.charAt(0) + status.slice(1).toLowerCase();

// AA contrast on white (the shared brand Button is below AA, a known deferred defect)
export const OWNER_PRIMARY = "rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400";
export const OWNER_SECONDARY = "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-50";
