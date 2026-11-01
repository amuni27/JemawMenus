import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { AUTH_FILE } from "./support/owner";

// AGF E4-M2 J19: the Super Admin sets the platform monetization configuration. Setting 2 with Models 2 and 4, then
// Setting 1; each save is confirmed, becomes a new version in the history and is audited. Owners can't change it. Works
// whatever the demo backend's current version is, so a retry doesn't depend on a fresh database.

function adminCredentials() {
    const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set (playwright.config.ts generates them)");
    return { email, password };
}

async function seriousViolations(page: import("@playwright/test").Page): Promise<string[]> {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
}

test.describe("J19 Monetization configuration", () => {
    test("the admin switches between Setting 2 and Setting 1 with confirmation, history and audit", async ({ page }) => {
        const { email, password } = adminCredentials();
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/super-admin/login");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

        await page.getByRole("link", { name: "Monetization" }).click();
        await expect(page.getByRole("heading", { name: "Monetization" })).toBeVisible();
        const current = page.getByRole("region", { name: "Current configuration" });
        await expect(current).toBeVisible();
        expect(await seriousViolations(page)).toEqual([]);

        // Setting 2 needs at least one model
        await page.getByRole("radio", { name: /Setting 2/ }).check();
        for (const name of [/Model 2/, /Model 3/, /Model 4/]) {
            const box = page.getByRole("checkbox", { name });
            if (await box.isChecked()) await box.uncheck();
        }
        await expect(page.getByRole("button", { name: "Save configuration" })).toBeDisabled();
        await page.getByRole("checkbox", { name: /Model 2/ }).check();
        await page.getByRole("checkbox", { name: /Model 4/ }).check();
        await page.getByRole("button", { name: "Save configuration" }).click();
        const dialog = page.getByRole("dialog", { name: "Change monetization configuration" });
        await expect(dialog).toContainText("Setting 2: Model 2, Model 4");
        await expect(dialog).toContainText("Existing subscriptions keep their terms");
        expect(await seriousViolations(page)).toEqual([]);
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(dialog).toBeHidden();
        await expect(current).toContainText("Setting 2");
        const afterSetting2 = Number((await current.textContent())?.match(/Version (\d+)/)?.[1]);
        expect(afterSetting2).toBeGreaterThanOrEqual(1);

        // Setting 1: the models are locked
        await page.getByRole("radio", { name: /Setting 1/ }).check();
        await expect(page.getByRole("checkbox", { name: /Model 3/ })).toBeDisabled();
        await page.getByRole("button", { name: "Save configuration" }).click();
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(current).toContainText(`Version ${afterSetting2 + 1}`);
        await expect(current).toContainText("Setting 1");

        const history = page.getByRole("table", { name: "Configuration history" });
        await expect(history.getByRole("row").nth(1)).toContainText(String(afterSetting2 + 1));
        await expect(history.getByRole("row").nth(1)).toContainText("Setting 1");
        await expect(history.getByRole("row").nth(2)).toContainText("Model 2, Model 4");
        expect(await seriousViolations(page)).toEqual([]);

        await page.getByRole("link", { name: "Audit log" }).click();
        const audit = page.getByRole("table", { name: "Audit log" });
        await expect(audit).toContainText("MONETIZATION_CONFIG_CHANGED");
        await expect(audit).toContainText("SETTING_1 [MODEL_1] (was SETTING_2 [MODEL_2, MODEL_4])");
    });

    test.describe("with an owner signed in", () => {
        test.use({ storageState: AUTH_FILE });

        test("an owner can't read or change the configuration", async ({ page, request }) => {
            await page.goto("/super-admin/login");
            const ownerToken = await page.evaluate(() => localStorage.getItem("token"));
            expect(ownerToken).toBeTruthy();
            const headers = { Authorization: `Bearer ${ownerToken}` };
            expect((await request.get("/api/admin/monetization-config", { headers })).status()).toBe(403);
            expect((await request.put("/api/admin/monetization-config", {
                headers, data: { setting: "SETTING_1", models: [], expectedVersion: 0 } })).status()).toBe(403);
        });
    });
});
