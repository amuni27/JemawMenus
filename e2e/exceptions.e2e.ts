import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { AUTH_FILE } from "./support/owner";

// AGF EX-F J35 (register §91): the Super Admin Exceptions page against the real backend (no stubs, D-S2-28-2). Billing is off
// in the demo, so no exception can exist: the page shows its empty state, the summary counts are all zero, the nav link has
// no badge, and the exception API is Super Admin only. Populated states and actions are covered by backend and Vitest tests.

function adminCredentials() {
    const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set (playwright.config.ts generates them)");
    return { email, password };
}

test.describe("J35 Super Admin exceptions", () => {
    test("the real empty state, zero counts and no badge, accessible at 1280 and 375 px; owners can't read exceptions", async ({ browser, request }) => {
        const { email, password } = adminCredentials();
        const page = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } })).newPage();
        await page.goto("/super-admin/login");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

        const adminToken = await page.evaluate(() => localStorage.getItem("adminToken"));
        const admin = { Authorization: "Bearer " + adminToken };
        const summary = await (await request.get("/api/admin/billing/exceptions/summary", { headers: admin })).json();
        expect(summary).toEqual({ unresolved: 0, open: 0, escalated: 0, autoHandling: 0, overdue: 0 });
        const list = await (await request.get("/api/admin/billing/exceptions?state=ALL", { headers: admin })).json();
        expect(list).toMatchObject({ items: [], page: 0, total: 0 });

        const nav = page.getByRole("navigation", { name: "Super Admin" });
        const link = nav.getByRole("link", { name: "Exceptions", exact: true });
        await expect(link).toHaveText("Exceptions"); // no badge at zero
        await link.click();
        await expect(page.getByRole("heading", { level: 1, name: "Exceptions" })).toBeVisible();
        await expect(page.getByText("No exceptions to review.")).toBeVisible();
        await expect(page.getByRole("list", { name: "Exception counts" })).toContainText("Unresolved 0");
        for (const width of [1280, 375]) {
            await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
            const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
            expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        }
        await page.getByLabel("Show").selectOption("ALL");
        await expect(page.getByText("No exceptions.", { exact: true })).toBeVisible();

        // an owner's token is refused; an unknown exception is 404
        const ownerPage = await (await browser.newContext({ storageState: AUTH_FILE })).newPage();
        await ownerPage.goto("/");
        const ownerToken = await ownerPage.evaluate(() => localStorage.getItem("token"));
        for (const path of ["/api/admin/billing/exceptions", "/api/admin/billing/exceptions/summary"]) {
            expect((await request.get(path, { headers: { Authorization: "Bearer " + ownerToken } })).status()).toBe(403);
        }
        expect((await request.get("/api/admin/billing/exceptions/00000000-0000-0000-0000-000000000000/history", { headers: admin })).status()).toBe(404);
    });
});
