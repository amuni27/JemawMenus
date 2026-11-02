import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// AGF E4-M5 J22: Model 1 trials (trials and owner plan visibility on in the local E2E demo only). The admin sets Setting 1;
// a newly registered restaurant gets a 30-day free trial; the owner sees the days left; the admin extends the trial, then
// converts it to a manual Model 1 record (no payment verified); the owner sees the plan and the trial stays in the history.
// Expiry itself is covered by backend tests with a controlled clock (E2E can't wait 30 days).

function adminCredentials() {
    const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set (playwright.config.ts generates them)");
    return { email, password };
}

async function seriousViolations(page: Page, include?: string): Promise<string[]> {
    let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
    if (include) builder = builder.include(include);
    return (await builder.analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
}

async function adminPage(browser: Browser): Promise<Page> {
    const { email, password } = adminCredentials();
    const page = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 375, height: 812 } })).newPage();
    await page.goto("/super-admin/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    return page;
}

async function configureSetting1(page: Page) {
    await page.getByRole("link", { name: "Monetization" }).click();
    const current = page.getByRole("region", { name: "Current configuration" });
    await expect(current).toBeVisible();
    if ((await current.textContent())?.includes("Setting 1")) return;
    await page.getByRole("radio", { name: /Setting 1/ }).check();
    await page.getByRole("button", { name: "Save configuration" }).click();
    await page.getByRole("dialog", { name: "Change monetization configuration" }).getByRole("button", { name: "Save" }).click();
    await expect(current).toContainText("Setting 1");
}

test.describe("J22 Trials", () => {
    test("a new restaurant gets a 30-day trial that the admin extends and converts to a manual Model 1 record", async ({ page, browser, request }) => {
        const admin = await adminPage(browser);
        await configureSetting1(admin);

        const stamp = Date.now().toString(36);
        const email = `trial-${stamp}@e2e.agafari.test`;
        const password = `Aa1!${randomUUID()}`; // local, per-run test value
        const name = `Trial Cafe ${stamp}`;
        const register = await request.post("/api/auth/register", { data: {
            fullName: "Trial Owner", email, password, businessName: name, businessPhone: `+2519${String(Date.now()).slice(-8)}`,
            customSubdomain: `trial-${stamp}`, open24_7: true, country: "ET", locationUrl: "https://maps.app.goo.gl/AbC123xyz",
        } });
        expect(register.status()).toBe(201);

        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/auth/login");
        await page.getByPlaceholder("you@example.com").fill(email);
        await page.getByPlaceholder("********").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page).toHaveURL(/\/admin/);
        const businessId = new URL(page.url()).pathname.split("/")[1];

        await page.goto(`/${businessId}/admin`);
        await expect(page.getByRole("region", { name: "Plan" })).toContainText("Free trial: 30 days left");
        await page.goto(`/${businessId}/admin/account`);
        const section = page.locator("#plan");
        await expect(section).toContainText("Free trial: 30 days left (ends");
        await expect(section).toContainText("All features stay available while plans are being introduced.");
        expect(await seriousViolations(page, "#plan")).toEqual([]);

        await admin.getByRole("link", { name: "Subscriptions" }).click();
        await admin.getByLabel("Search restaurants").fill(name);
        await admin.getByRole("button", { name: "Search" }).click();
        await admin.getByRole("table", { name: "Restaurants" }).getByRole("button", { name: `Open ${name}` }).click();
        const detail = admin.getByRole("region", { name: `${name} subscription` });
        await expect(detail).toContainText("Model 1 · Trial · ends");
        await expect(detail).toContainText("Trial (automatic), no payment involved");
        expect(await seriousViolations(admin)).toEqual([]);

        const newEnd = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);
        await detail.getByRole("button", { name: "Extend trial" }).click();
        const extend = admin.getByRole("dialog", { name: "Extend trial" });
        await extend.getByLabel("New end date").fill(newEnd);
        await extend.getByRole("button", { name: "Extend" }).click();
        await page.reload();
        await expect(section).toContainText(/Free trial: 4[45] days left/);

        await detail.getByRole("button", { name: "Convert to manual Model 1 record" }).click();
        const convert = admin.getByRole("dialog", { name: "Convert trial" });
        await expect(convert).toContainText("Manual record. No payment is taken or verified.");
        expect(await seriousViolations(admin, '[role="dialog"]')).toEqual([]);
        await convert.getByRole("button", { name: "Convert" }).click();
        await expect(detail).toContainText("Model 1 · ACTIVE");
        await expect(detail).toContainText("Manual record, no payment verified");
        const history = admin.getByRole("table", { name: "Subscription history" });
        await expect(history).toContainText("Trial (automatic), no payment involved");
        await expect(history).toContainText("Manual record, no payment verified");

        await page.reload();
        await expect(section).toContainText("Model 1 · Active");
        await expect(section).toContainText("Manual record, no payment verified");

        await admin.getByRole("link", { name: "Audit log" }).click();
        const audit = admin.getByRole("table", { name: "Audit log" });
        await expect(audit).toContainText("TRIAL_STARTED");
        await expect(audit).toContainText("TRIAL_EXTENDED");
        await expect(audit).toContainText("TRIAL_CONVERTED");
    });
});
