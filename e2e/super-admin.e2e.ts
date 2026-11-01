import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { AUTH_FILE } from "./support/owner";

// AGF E4-M1 J18: the Super Admin console. The suite's demo backend bootstraps the first admin from random per-run values
// (playwright.config.ts). The admin signs in at /super-admin/login, sees their own sign-in in the audit log and signs out;
// owner tokens are refused on admin APIs; no serious accessibility violations at phone width.

function adminCredentials() {
    const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set (playwright.config.ts generates them)");
    return { email, password };
}

async function seriousViolations(page: import("@playwright/test").Page): Promise<string[]> {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
}

test.describe("J18 Super Admin console", () => {
    test("the bootstrapped admin signs in, sees the audit log and signs out", async ({ page }) => {
        const { email, password } = adminCredentials();
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto("/super-admin");
        await expect(page).toHaveURL(/\/super-admin\/login$/); // no admin session yet

        await expect(page.getByRole("heading", { name: "Super Admin sign-in" })).toBeVisible();
        expect(await seriousViolations(page)).toEqual([]);
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();

        await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
        await expect(page.getByText(email).first()).toBeVisible();
        await page.getByRole("link", { name: "Audit log" }).click();
        const table = page.getByRole("table", { name: "Audit log" });
        await expect(table).toContainText("ADMIN_LOGIN_SUCCEEDED");
        await expect(table).toContainText("ADMIN_BOOTSTRAP_CREATED");
        await expect(table).not.toContainText(password);
        expect(await seriousViolations(page)).toEqual([]);

        await page.getByRole("button", { name: "Sign out" }).click();
        await expect(page).toHaveURL(/\/super-admin\/login$/);
        expect(await page.evaluate(() => localStorage.getItem("adminToken"))).toBeNull();
    });

    test.describe("with an owner signed in", () => {
        test.use({ storageState: AUTH_FILE });

        test("an owner token is refused on admin APIs and the owner session is untouched by the console", async ({ page, request }) => {
            await page.goto("/super-admin");
            await expect(page).toHaveURL(/\/super-admin\/login$/);
            const ownerToken = await page.evaluate(() => localStorage.getItem("token"));
            expect(ownerToken).toBeTruthy();

            const res = await request.get("/api/admin/me", { headers: { Authorization: `Bearer ${ownerToken}` } });
            expect(res.status()).toBe(403);
            expect(await page.evaluate(() => localStorage.getItem("token"))).toBe(ownerToken);
        });
    });
});
