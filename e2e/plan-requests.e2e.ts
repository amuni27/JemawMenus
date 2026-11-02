import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { AUTH_FILE, BUSINESS_ID, RESTAURANT } from "./support/owner";

// AGF E4-M4 J21: owner plan requests. The admin enables Models 2 and 4; the owner (plans visible in the E2E demo only)
// sees them without prices on the account page, requests Model 4 (a request, not a purchase); the admin fulfils it from
// Plan requests (manual record, no payment verified); the owner then sees the plan with no change action. A second round
// shows withdrawing. Works whatever state earlier journeys left behind.

function adminCredentials() {
    const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set (playwright.config.ts generates them)");
    return { email, password };
}

async function seriousViolations(page: Page, include?: string): Promise<string[]> {
    let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
    if (include) builder = builder.include(include);
    const result = await builder.analyze();
    return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
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

async function configureModels2And4(page: Page) {
    await page.getByRole("link", { name: "Monetization" }).click();
    const current = page.getByRole("region", { name: "Current configuration" });
    await expect(current).toBeVisible();
    await page.getByRole("radio", { name: /Setting 2/ }).check();
    for (const [m, on] of [["2", true], ["3", false], ["4", true]] as const) {
        const box = page.getByRole("checkbox", { name: new RegExp(`Model ${m}`) });
        if (on) await box.check(); else if (await box.isChecked()) await box.uncheck();
    }
    const save = page.getByRole("button", { name: "Save configuration" });
    await save.click();
    await page.getByRole("dialog", { name: "Change monetization configuration" }).getByRole("button", { name: "Save" }).click();
    await expect(current).toContainText("Model 4");
}

/** Leaves the demo restaurant with no current subscription and no pending request. */
async function clearRestaurant(page: Page) {
    await page.getByRole("link", { name: "Subscriptions" }).click();
    await page.getByRole("table", { name: "Restaurants" }).getByRole("button", { name: `Open ${RESTAURANT}` }).click();
    const detail = page.getByRole("region", { name: `${RESTAURANT} subscription` });
    await expect(detail.getByText(/No subscription|Configuration version/).first()).toBeVisible();
    const decline = detail.getByRole("button", { name: `Decline request from ${RESTAURANT}` });
    if (await decline.isVisible()) {
        await decline.click();
        await page.getByRole("dialog", { name: "Decline plan request" }).getByRole("button", { name: "Decline" }).click();
    }
    const end = detail.getByRole("button", { name: "End subscription" });
    if (await end.isVisible()) {
        await end.click();
        await page.getByRole("dialog", { name: "End subscription" }).getByRole("button", { name: "End subscription" }).click();
    }
    await expect(detail.getByLabel("Plan")).toBeVisible();
}

test.describe("J21 Owner plan requests", () => {
    test.use({ storageState: AUTH_FILE });

    test("the owner requests Model 4, the admin fulfils it and the owner sees the plan; a second request is withdrawn", async ({ page, browser }) => {
        const admin = await adminPage(browser);
        await configureModels2And4(admin);
        await clearRestaurant(admin);

        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(`/${BUSINESS_ID}/admin`);
        const card = page.getByRole("region", { name: "Plan" });
        await expect(card).toContainText("Choose a plan for your restaurant");
        await page.goto(`/${BUSINESS_ID}/admin/account`);
        const section = page.locator("#plan");
        await expect(section).toContainText("Pricing will be announced");
        await expect(section).toContainText("All features stay available while plans are being introduced.");
        await expect(section.getByRole("button", { name: "Request Model 3" })).toHaveCount(0);
        expect(await seriousViolations(page, "#plan")).toEqual([]);

        await section.getByRole("button", { name: "Request Model 4" }).click();
        const dialog = page.getByRole("dialog", { name: "Request a plan" });
        await expect(dialog).toContainText("This is a request, not a purchase.");
        expect(await seriousViolations(page, '[role="dialog"]')).toEqual([]);
        await dialog.getByRole("button", { name: "Send request" }).click();
        await expect(section).toContainText("Request for Model 4 sent on");

        await admin.getByRole("link", { name: "Plan requests" }).click();
        const table = admin.getByRole("table", { name: "Plan requests" });
        await expect(table).toContainText(RESTAURANT);
        expect(await seriousViolations(admin)).toEqual([]);
        await table.getByRole("button", { name: `Fulfil request from ${RESTAURANT}` }).click();
        const fulfil = admin.getByRole("dialog", { name: "Fulfil plan request" });
        await expect(fulfil).toContainText("Manual record. No payment is taken or verified.");
        await fulfil.getByRole("button", { name: "Fulfil" }).click();
        await expect(admin.getByText("No pending plan requests.")).toBeVisible();

        await page.reload();
        await expect(section).toContainText("Model 4 · Active");
        await expect(section).toContainText("Manual record, no payment verified");
        await expect(section.getByRole("button")).toHaveCount(0); // no request or change action

        // second round: end the subscription, the owner requests Model 2 and withdraws it
        await clearRestaurant(admin);
        await page.reload();
        await section.getByRole("button", { name: "Request Model 2" }).click();
        await page.getByRole("dialog", { name: "Request a plan" }).getByRole("button", { name: "Send request" }).click();
        await section.getByRole("button", { name: "Withdraw request" }).click();
        await page.getByRole("dialog", { name: "Withdraw request" }).getByRole("button", { name: "Withdraw" }).click();
        await expect(section.getByRole("button", { name: "Request Model 2" })).toBeVisible();

        await admin.getByRole("link", { name: "Audit log" }).click();
        const audit = admin.getByRole("table", { name: "Audit log" });
        await expect(audit).toContainText("OWNER_PLAN_REQUESTED");
        await expect(audit).toContainText("PLAN_REQUEST_FULFILLED");
        await expect(audit).toContainText("OWNER_PLAN_REQUEST_WITHDRAWN");
    });

    test("an admin token is refused on the owner plan API and an owner token on admin plan requests", async ({ page, request, browser }) => {
        await page.goto(`/${BUSINESS_ID}/admin`);
        const ownerToken = await page.evaluate(() => localStorage.getItem("token"));
        expect((await request.get("/api/admin/plan-requests", { headers: { Authorization: `Bearer ${ownerToken}` } })).status()).toBe(403);
        const admin = await adminPage(browser);
        const adminToken = await admin.evaluate(() => localStorage.getItem("adminToken"));
        expect((await request.get("/api/plan", { headers: { Authorization: `Bearer ${adminToken}` } })).status()).toBe(403);
    });
});
