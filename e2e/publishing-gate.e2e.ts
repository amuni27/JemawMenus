import { expect, test } from "@playwright/test";

// AGF FE-4 J29b (backend BE-6): on the main demo backend no cut-over is configured, so the dry run shows the blocker and
// can't be signed off. Nothing on the page can enable the gate.

test.describe("J29b Publishing gate dry run without a cut-over", () => {
    test("shows the blocker and offers no sign-off", async ({ browser }) => {
        const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
        if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set (playwright.config.ts generates them)");
        const page = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } })).newPage();
        await page.goto("/super-admin/login");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.getByRole("link", { name: "Publishing gate" }).click();

        await expect(page.getByRole("alert")).toContainText("Cut-over date not configured");
        await expect(page.getByRole("button", { name: /^Sign off ET/ })).toBeDisabled();
        await expect(page.getByRole("region", { name: "Report facts" })).toContainText("Publishing gate: Off");
    });
});
