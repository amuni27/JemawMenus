import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { AUTH_FILE } from "./support/owner";

// AGF SA-P1 J34 (register §88, Route C): the Super Admin adds a paid-plan price version and activates it through the real backend
// (no stubs, D-S2-28-2). A version starts inactive; activation needs a confirmation and adds the version in effect. The currency
// follows the market. Prices stay hidden from owners while the market's price display is off (as in the demo), so the owner's
// plan view still has no prices: configuring a price never shows or charges anything by itself.

function adminCredentials() {
    const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set (playwright.config.ts generates them)");
    return { email, password };
}

test.describe("J34 Super Admin plan prices", () => {
    test("adds a version, activates it after a confirmation, and owners still see no price while display is off", async ({ browser, request }) => {
        const { email, password } = adminCredentials();
        const page = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } })).newPage();
        await page.goto("/super-admin/login");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
        await page.getByRole("navigation", { name: "Super Admin" }).getByRole("link", { name: "Prices" }).click();
        await expect(page.getByRole("heading", { level: 1, name: "Plan prices" })).toBeVisible();

        // a per-run synthetic amount, so this run's rows are found among earlier runs' versions
        const cents = String(Date.now() % 100).padStart(2, "0");
        const whole = 10 + (Math.floor(Date.now() / 100) % 80);
        const shown = "$" + whole + "." + cents;
        const form = page.getByRole("form", { name: "Add a price version" });
        await form.getByLabel("Plan").selectOption("MODEL_3");
        await form.getByRole("group", { name: "Market" }).getByRole("radio", { name: /^US/ }).check();
        await expect(form.getByText("Currency: USD")).toBeVisible();
        await form.getByRole("group", { name: "Billing interval" }).getByRole("radio", { name: "Monthly" }).check();
        await form.getByLabel(/^Amount/).fill(whole + "." + cents);
        await form.getByLabel(/Stripe price ID/).fill("price_e2e_synthetic");
        await form.getByRole("button", { name: "Add version" }).click();
        await expect(form.getByRole("status")).toHaveText("Version added. Activate it to make it the price in effect.");

        const table = page.getByRole("table", { name: "Price versions" });
        const added = table.getByRole("row").filter({ hasText: shown }).filter({ hasText: "Not active" });
        await expect(added).toHaveCount(1);
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

        await added.getByRole("button", { name: /^Activate Model 3 · Business Ads US monthly version \d+$/ }).click();
        const dialog = page.getByRole("dialog", { name: "Activate this price?" });
        await expect(dialog).toContainText("It doesn't charge anyone or turn on payment.");
        await dialog.getByRole("button", { name: "Activate" }).click();
        await expect(table.getByRole("row").filter({ hasText: shown }).filter({ hasText: "In effect" })).toHaveCount(1);

        // the backend agrees, and owners still get no prices while the market's display is off
        const adminToken = await page.evaluate(() => localStorage.getItem("adminToken"));
        const versions = (await (await request.get("/api/admin/prices", { headers: { Authorization: "Bearer " + adminToken } })).json()) as
            { planCode: string; market: string; currency: string; interval: string; amountMinor: number; active: boolean; providerPriceRef: string }[];
        expect(versions.some((v) => v.planCode === "MODEL_3" && v.market === "US" && v.currency === "USD" && v.interval === "MONTH"
            && v.amountMinor === whole * 100 + Number(cents) && v.active && v.providerPriceRef === "price_e2e_synthetic")).toBe(true);
        const ownerPage = await (await browser.newContext({ storageState: AUTH_FILE })).newPage();
        await ownerPage.goto("/");
        const ownerToken = await ownerPage.evaluate(() => localStorage.getItem("token"));
        const view = await (await request.get("/api/plan", { headers: { Authorization: "Bearer " + ownerToken } })).json();
        expect(view).not.toHaveProperty("prices");
    });
});
