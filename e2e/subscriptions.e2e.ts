import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./support/owner";

// AGF E4-M3 J20: manual subscription records. The admin enables Model 4 (Setting 2), records a Model 4 subscription for
// the demo restaurant (marked "Manual record, no payment verified"), sees it in the audit log, switches the configuration
// to Setting 1 and sees the subscription flagged "Outside current configuration" (never changed), then ends it and finds
// it in the history. Owners can't use the subscription APIs. Works whatever state earlier journeys left behind.

const RESTAURANT = "Abol Demo Café";

function adminCredentials() {
    const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set (playwright.config.ts generates them)");
    return { email, password };
}

async function seriousViolations(page: Page): Promise<string[]> {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
}

async function configure(page: Page, setting: 1 | 2, models: string[] = []) {
    await page.getByRole("link", { name: "Monetization" }).click();
    const current = page.getByRole("region", { name: "Current configuration" });
    await expect(current).toBeVisible();
    await page.getByRole("radio", { name: new RegExp(`Setting ${setting}`) }).check();
    if (setting === 2) {
        for (const m of ["2", "3", "4"]) {
            const box = page.getByRole("checkbox", { name: new RegExp(`Model ${m}`) });
            if (models.includes(m)) await box.check(); else if (await box.isChecked()) await box.uncheck();
        }
    }
    await page.getByRole("button", { name: "Save configuration" }).click();
    await page.getByRole("dialog", { name: "Change monetization configuration" }).getByRole("button", { name: "Save" }).click();
    await expect(current).toContainText(`Setting ${setting}`);
}

async function openRestaurant(page: Page) {
    await page.getByRole("link", { name: "Subscriptions" }).click();
    await page.getByRole("table", { name: "Restaurants" }).getByRole("button", { name: `Open ${RESTAURANT}` }).click();
    const detail = page.getByRole("region", { name: `${RESTAURANT} subscription` });
    await expect(detail.getByText(/No subscription|Configuration version/).first()).toBeVisible();
    return detail;
}

async function endIfCurrent(page: Page, detail: import("@playwright/test").Locator) {
    const end = detail.getByRole("button", { name: "End subscription" });
    if (await end.isVisible()) {
        await end.click();
        await page.getByRole("dialog", { name: "End subscription" }).getByRole("button", { name: "End subscription" }).click();
        await expect(detail.getByText("No subscription")).toBeVisible();
    }
}

test.describe("J20 Subscriptions", () => {
    test("the admin records a manual Model 4 subscription, sees it outside a later configuration, ends it and keeps the history", async ({ page }) => {
        const { email, password } = adminCredentials();
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/super-admin/login");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

        await configure(page, 2, ["4"]);
        let detail = await openRestaurant(page);
        await endIfCurrent(page, detail); // a retry may find the subscription of an earlier attempt
        await expect(detail).toContainText("Monetization is inactive"); // the activation flag stays off
        expect(await seriousViolations(page)).toEqual([]);

        await page.getByLabel("Plan").selectOption("MODEL_4");
        await page.getByRole("button", { name: "Record subscription" }).click();
        const dialog = page.getByRole("dialog", { name: "Record subscription" });
        await expect(dialog).toContainText("Manual record. No payment is taken or verified.");
        expect(await seriousViolations(page)).toEqual([]);
        await dialog.getByRole("button", { name: "Record" }).click();
        await expect(detail).toContainText("Model 4 · ACTIVE");
        await expect(detail).toContainText("Manual record, no payment verified");
        await expect(detail.getByRole("button", { name: /change plan/i })).toHaveCount(0);

        await configure(page, 1);
        detail = await openRestaurant(page);
        await expect(detail).toContainText("Outside current configuration");
        await expect(detail).toContainText("Model 4 · ACTIVE"); // the configuration change didn't touch it

        await endIfCurrent(page, detail);
        const history = page.getByRole("table", { name: "Subscription history" });
        await expect(history.getByRole("row").nth(1)).toContainText("EXPIRED");
        await expect(history.getByRole("row").nth(1)).toContainText("Model 4");
        await expect(page.getByLabel("Plan")).toBeVisible(); // a new record is possible only now
        expect(await seriousViolations(page)).toEqual([]);

        await page.getByRole("link", { name: "Audit log" }).click();
        const audit = page.getByRole("table", { name: "Audit log" });
        await expect(audit).toContainText("SUBSCRIPTION_CREATED");
        await expect(audit).toContainText("SUBSCRIPTION_UPDATED");
        await expect(audit).toContainText("source=MANUAL");
    });

    test.describe("with an owner signed in", () => {
        test.use({ storageState: AUTH_FILE });

        test("an owner can't use the plan, restaurant or subscription APIs", async ({ page, request }) => {
            await page.goto("/super-admin/login");
            const ownerToken = await page.evaluate(() => localStorage.getItem("token"));
            expect(ownerToken).toBeTruthy();
            const headers = { Authorization: `Bearer ${ownerToken}` };
            for (const path of ["/api/admin/plans", "/api/admin/businesses"]) {
                expect((await request.get(path, { headers })).status()).toBe(403);
            }
            expect((await request.post("/api/admin/businesses/any/subscription", {
                headers, data: { planCode: "MODEL_4", expectedConfigVersion: 1 } })).status()).toBe(403);
        });
    });
});
