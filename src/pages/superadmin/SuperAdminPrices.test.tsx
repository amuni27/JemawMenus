// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// AGF SA-P1 (register §88, Route C): the Super Admin manages paid-plan prices over the existing SUB-R3-01 API. A version is
// added inactive and is activated separately, after a confirmation; versions are never edited or deleted. The currency follows
// the market (US: USD, ET: ETB); intervals are monthly or yearly; amounts are entered in the currency's main unit and sent in
// minor units. Nothing here shows prices to owners (that's each market's price display switch) or charges anyone.

const prices = vi.fn(), createPrice = vi.fn(), activatePrice = vi.fn();
vi.mock("../../api/adminApi", async (orig) => ({
    ...(await orig<typeof import("../../api/adminApi")>()),
    adminApi: { prices, createPrice, activatePrice },
}));

const { default: SuperAdminPrices } = await import("./SuperAdminPrices.tsx");

const version = (over: Record<string, unknown> = {}) => ({ id: "v1", planCode: "MODEL_4", market: "US", currency: "USD", interval: "MONTH", amountMinor: 2500,
    version: 1, providerPriceRef: null, active: false, validFrom: "2026-11-01T00:00:00Z", ...over });

beforeEach(() => {
    for (const f of [prices, createPrice, activatePrice]) f.mockReset();
    prices.mockResolvedValue({ data: [] });
    createPrice.mockResolvedValue({ status: 201, data: version({ id: "v-new" }) });
    activatePrice.mockResolvedValue({ status: 201, data: version({ id: "v2", version: 2, active: true }) });
});
afterEach(() => cleanup());

const form = () => screen.getByRole("form", { name: "Add a price version" });
const fill = (f: HTMLElement, { plan = "Model 4 · Ad-Free", market = "US", interval = "Monthly", amount = "25.00", ref = "" } = {}) => {
    fireEvent.change(within(f).getByLabelText("Plan"), { target: { value: plan === "Model 4 · Ad-Free" ? "MODEL_4" : "MODEL_3" } });
    fireEvent.click(within(within(f).getByRole("group", { name: "Market" })).getByRole("radio", { name: new RegExp(`^${market}`) }));
    fireEvent.click(within(within(f).getByRole("group", { name: "Billing interval" })).getByRole("radio", { name: interval }));
    fireEvent.change(within(f).getByLabelText(/^Amount/), { target: { value: amount } });
    if (ref) fireEvent.change(within(f).getByLabelText(/Stripe price ID/), { target: { value: ref } });
};

describe("Super Admin plan prices", () => {
    it("says when no price exists yet and never shows an invented price", async () => {
        render(<SuperAdminPrices />);
        expect(await screen.findByText("No prices yet. Owners see “Price not available” for every paid plan.")).toBeTruthy();
        expect(screen.queryByRole("table", { name: "Price versions" })).toBeNull();
        expect(document.body.textContent).not.toMatch(/\$\d|ETB\s?\d/);
    });

    it("lists the versions with plan, market, interval, amount, version, status and Stripe price ID; marks the one in effect", async () => {
        prices.mockResolvedValue({ data: [
            version({ id: "a1", active: true, version: 1, amountMinor: 2000 }),
            version({ id: "a2", active: true, version: 2, amountMinor: 2500, providerPriceRef: "price_test_synthetic" }),
            version({ id: "a3", active: false, version: 3, amountMinor: 3000 }),
            version({ id: "a4", active: true, version: 4, amountMinor: 3500, validFrom: "2099-01-01T00:00:00Z" }), // a later start doesn't replace a2 yet
            version({ id: "e1", planCode: "MODEL_3", market: "ET", currency: "ETB", interval: "YEAR", amountMinor: 250000, active: true, version: 1, validFrom: "2099-01-01T00:00:00Z" }),
        ] });
        render(<SuperAdminPrices />);
        const table = await screen.findByRole("table", { name: "Price versions" });
        expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Plan", "Market", "Interval", "Amount", "Version", "Status", "Valid from", "Stripe price ID", "Actions"]);
        const rows = within(table).getAllByRole("row").slice(1);
        const row = (id: string) => rows.find((r) => r.getAttribute("data-price-id") === id)!;
        expect(row("a2").textContent).toContain("$25.00");
        expect(row("a2").textContent).toContain("In effect");
        expect(row("a2").textContent).toContain("price_test_synthetic");
        expect(row("a1").textContent).toContain("Active (replaced)");
        expect(row("a3").textContent).toContain("Not active");
        expect(row("a4").textContent).toContain("Scheduled");
        expect(within(row("a3")).getByRole("button", { name: "Activate Model 4 · Ad-Free US monthly version 3" })).toBeTruthy();
        expect(within(row("a2")).queryByRole("button")).toBeNull();
        expect(row("e1").textContent).toMatch(/ETB\s?2,500\.00/);
        expect(row("e1").textContent).toContain("Scheduled");
        expect(row("e1").textContent).toContain("Yearly");
    });

    it("shows the currency from the chosen market and adds an inactive version in minor units", async () => {
        render(<SuperAdminPrices />);
        await screen.findByText(/No prices yet/);
        const f = form();
        fill(f, { market: "ET", interval: "Yearly", amount: "2500.5", ref: " price_test_synthetic " });
        expect(within(f).getByText("Currency: ETB")).toBeTruthy();
        prices.mockResolvedValue({ data: [version({ id: "v-new" })] });
        fireEvent.click(within(f).getByRole("button", { name: "Add version" }));
        await waitFor(() => expect(createPrice).toHaveBeenCalledWith({ planCode: "MODEL_4", market: "ET", interval: "YEAR", amountMinor: 250050,
            providerPriceRef: "price_test_synthetic", validFrom: null }));
        expect(await screen.findByText("Version added. Activate it to make it the price in effect.")).toBeTruthy();
        expect(activatePrice).not.toHaveBeenCalled();
        expect(prices).toHaveBeenCalledTimes(2);
    });

    it.each([["", "Enter an amount."], ["0", "Enter an amount above zero."], ["-5", "Enter an amount above zero."], ["12.345", "Use at most two decimal places."],
        ["abc", "Enter an amount, like 25.00."]])("refuses the amount %j without calling the API", async (amount, message) => {
        render(<SuperAdminPrices />);
        await screen.findByText(/No prices yet/);
        fill(form(), { amount });
        fireEvent.click(within(form()).getByRole("button", { name: "Add version" }));
        expect((await within(form()).findByRole("alert")).textContent).toBe(message);
        expect(within(form()).getByLabelText(/^Amount/).getAttribute("aria-invalid")).toBe("true");
        expect(createPrice).not.toHaveBeenCalled();
    });

    it("requires a plan, market and interval", async () => {
        render(<SuperAdminPrices />);
        await screen.findByText(/No prices yet/);
        fireEvent.change(within(form()).getByLabelText(/^Amount/), { target: { value: "25" } });
        fireEvent.click(within(form()).getByRole("button", { name: "Add version" }));
        expect((await within(form()).findByRole("alert")).textContent).toBe("Choose a plan, a market and a billing interval.");
        expect(createPrice).not.toHaveBeenCalled();
    });

    it("offers only paid plans", async () => {
        render(<SuperAdminPrices />);
        await screen.findByText(/No prices yet/);
        const options = within(within(form()).getByLabelText("Plan")).getAllByRole("option").map((o) => o.textContent);
        expect(options).toEqual(["Choose a plan", "Model 3 · Business Ads", "Model 4 · Ad-Free"]);
    });

    it("shows the server's field message when it refuses", async () => {
        createPrice.mockRejectedValue({ response: { status: 400, data: { message: "Validation failed", fieldErrors: [{ field: "amountMinor", message: "Enter a whole number of minor units" }] } } });
        render(<SuperAdminPrices />);
        await screen.findByText(/No prices yet/);
        fill(form());
        fireEvent.click(within(form()).getByRole("button", { name: "Add version" }));
        expect((await within(form()).findByRole("alert")).textContent).toContain("Enter a whole number of minor units");
    });

    it("activates a version only after a confirmation that says what it does and doesn't do", async () => {
        prices.mockResolvedValue({ data: [version({ id: "a3", version: 3 })] });
        render(<SuperAdminPrices />);
        fireEvent.click(await screen.findByRole("button", { name: "Activate Model 4 · Ad-Free US monthly version 3" }));
        const dialog = screen.getByRole("dialog", { name: "Activate this price?" });
        expect(dialog.textContent).toContain("Model 4 · Ad-Free, US, monthly: $25.00");
        expect(dialog.textContent).toContain("It becomes the price in effect from its start date. Owners see it only where the market's price display is on. It doesn't charge anyone or turn on payment.");
        expect(activatePrice).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
        expect(activatePrice).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Activate Model 4 · Ad-Free US monthly version 3" }));
        fireEvent.click(within(screen.getByRole("dialog", { name: "Activate this price?" })).getByRole("button", { name: "Activate" }));
        await waitFor(() => expect(activatePrice).toHaveBeenCalledWith("a3"));
        await waitFor(() => expect(prices).toHaveBeenCalledTimes(2));
    });

    it("reports a failed load", async () => {
        prices.mockRejectedValue({ response: { status: 500 } });
        render(<SuperAdminPrices />);
        expect((await screen.findByRole("alert")).textContent).toContain("Couldn't load the prices.");
    });
});
