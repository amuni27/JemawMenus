// AGF E4-M4: owner-facing plan wording. No prices, payments, trials or limits exist yet.
export const modelName = (code: string) => `Model ${code.slice(-1)}`;

export const PLAN_DESCRIPTIONS: Record<string, string> = {
    MODEL_1: "Free trial, then a paid subscription",
    MODEL_2: "Free, with Agafari ads",
    MODEL_3: "Paid, with your own ads on your menus",
    MODEL_4: "Lower-cost paid plan, no ads",
};

export const FEATURES_NOTE = "All features stay available while plans are being introduced.";

export const statusLabel = (status: string) => status.charAt(0) + status.slice(1).toLowerCase();

// AA contrast on white (the shared brand Button is below AA, a known deferred defect)
export const OWNER_PRIMARY = "rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400";
export const OWNER_SECONDARY = "rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-50";
