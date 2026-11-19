import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// AGF E4-M5 J22: Model 1 trials (trials and owner plan visibility on in the local E2E demo only). The admin sets Setting 1;
// AGF BE-2 (register §45 D-3 B, §48): a newly registered restaurant gets no automatic trial; the owner verifies their email,
// confirms and starts the 30-day free trial (BE-1/FE-1); the owner sees the days left; the admin extends the trial, then
// converts it to a manual Model 1 record (no payment verified); the owner sees the plan and the trial stays in the history.
// Expiry itself is covered by backend tests with a controlled clock (E2E can't wait 30 days).

const BACKEND = "http://127.0.0.1:8081";

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

// AGF FE-1 J27: Setting 2 registrations get no trial; the restaurant becomes eligible once the admin sets Setting 1.
async function configureSetting2(page: Page) {
    await page.getByRole("link", { name: "Monetization" }).click();
    const current = page.getByRole("region", { name: "Current configuration" });
    await expect(current).toBeVisible();
    await page.getByRole("radio", { name: /Setting 2/ }).check();
    for (const [m, on] of [["2", true], ["3", false], ["4", true]] as const) {
        const box = page.getByRole("checkbox", { name: new RegExp(`Model ${m}`) });
        if (on) await box.check(); else if (await box.isChecked()) await box.uncheck();
    }
    await page.getByRole("button", { name: "Save configuration" }).click();
    await page.getByRole("dialog", { name: "Change monetization configuration" }).getByRole("button", { name: "Save" }).click();
    await expect(current).toContainText("Setting 2");
}

test.describe("J22 Trials", () => {
    test("a new restaurant gets no automatic trial; the owner starts the 30-day trial, which the admin extends and converts to a manual Model 1 record", async ({ page, browser, request }) => {
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

        // BE-2: no trial at registration; the owner is offered one, after verifying their email (operational here, Q2)
        await page.goto(`/${businessId}/admin/plans`); // ONB Phase 1: plans live on Subscription & Plans
        const section = page.locator("#plan");
        const offer = page.getByRole("region", { name: "Free trial" });
        await expect(offer).toContainText("Try Agafari free for 30 days.");
        await expect(offer).toContainText("Verify your email to start your free trial.");
        await expect(section).not.toContainText("days left");
        const outbox = await request.get(`${BACKEND}/api/demo/email-verification-outbox`, { params: { email } });
        expect(outbox.status()).toBe(200);
        await page.goto((await outbox.json()).verifyUrl as string);
        await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
        await page.goto(`/${businessId}/admin/plans`);
        await offer.getByRole("button", { name: "Start free trial" }).click();
        await page.getByRole("dialog", { name: "Start your 30-day free trial?" }).getByRole("button", { name: "Start free trial" }).click();
        await expect(section.getByRole("status")).toContainText("Your free trial has started.");

        await page.goto(`/${businessId}/admin`);
        await expect(page.getByRole("region", { name: "Plan" })).toContainText("Free trial: 30 days left");
        await page.goto(`/${businessId}/admin/plans`);
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
        // Option A: the trial runs through the chosen day in the restaurant's time zone (Ethiopia: the end is 21:00 UTC that day),
        // and the owner sees that day, whatever the browser's time zone
        await page.reload();
        const daysLeft = Math.ceil((Date.parse(`${newEnd}T21:00:00Z`) - Date.now()) / 86_400_000);
        const [y, m, d] = newEnd.split("-").map(Number);
        await expect(section).toContainText(new RegExp(`Free trial: (${daysLeft}|${daysLeft - 1}) days left \\(ends ${m}/${d}/${y}\\)`));
        await expect(detail).toContainText(`Model 1 · Trial · ends ${m}/${d}/${y}`);

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

    // AGF FE-1 J27 (backend BE-1): the owner starts the free trial themselves on Subscription & Plans, after verifying their
    // email (verification is operational in this demo, Q2) and confirming; the trial then runs for 30 days.
    test("J27 an eligible owner verifies their email, confirms and starts the 30-day free trial", async ({ page, browser, request }) => {
        const admin = await adminPage(browser);
        await configureSetting2(admin);
        const stamp = Date.now().toString(36);
        const email = `owner-trial-${stamp}@e2e.agafari.test`;
        const password = `Aa1!${randomUUID()}`; // local, per-run test value
        const register = await request.post("/api/auth/register", { data: {
            fullName: "Trial Owner", email, password, businessName: `Owner Trial Cafe ${stamp}`, businessPhone: `+2519${String(Date.now()).slice(-8)}`,
            customSubdomain: `owner-trial-${stamp}`, open24_7: true, country: "ET", locationUrl: "https://maps.app.goo.gl/AbC123xyz",
        } });
        expect(register.status()).toBe(201);
        await configureSetting1(admin);

        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/auth/login");
        await page.getByPlaceholder("you@example.com").fill(email);
        await page.getByPlaceholder("********").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page).toHaveURL(/\/admin/);
        const businessId = new URL(page.url()).pathname.split("/")[1];

        await page.goto(`/${businessId}/admin/plans`);
        const offer = page.getByRole("region", { name: "Free trial" });
        await expect(offer).toContainText("Try Agafari free for 30 days.");
        await expect(offer).toContainText("Verify your email to start your free trial.");
        await expect(offer.getByRole("button", { name: "Start free trial" })).toHaveCount(0);

        const outbox = await request.get(`${BACKEND}/api/demo/email-verification-outbox`, { params: { email } });
        expect(outbox.status()).toBe(200);
        await page.goto((await outbox.json()).verifyUrl as string);
        await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();

        await page.goto(`/${businessId}/admin/plans`);
        await offer.getByRole("button", { name: "Start free trial" }).click();
        const dialog = page.getByRole("dialog", { name: "Start your 30-day free trial?" });
        await expect(dialog).toContainText("There's no charge and no payment details are needed.");
        expect(await seriousViolations(page, '[role="dialog"]')).toEqual([]);
        await dialog.getByRole("button", { name: "Start free trial" }).click();

        const section = page.locator("#plan");
        await expect(section.getByRole("status")).toContainText("Your free trial has started.");
        await expect(section).toContainText("Free trial: 30 days left (ends");
        await expect(section.getByRole("button", { name: "Start free trial" })).toHaveCount(0);
        expect(await seriousViolations(page, "#plan")).toEqual([]);

        await admin.getByRole("link", { name: "Audit log" }).click();
        await expect(admin.getByRole("table", { name: "Audit log" })).toContainText("TRIAL_STARTED");
    });
});
