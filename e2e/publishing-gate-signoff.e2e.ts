import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// AGF FE-4 J29 (backend BE-6; register §56–§58): the Super Admin reviews the publishing-gate dry run and signs it off. Runs in
// the onboarding project (backend 8083 / frontend 5178), where the cut-over is configured and owner plans are visible, so the
// report has no blockers. Signing off only records the review: the gate stays off (it can't start on this H2 demo anyway).

const BACKEND = "http://127.0.0.1:8083";

function adminCredentials() {
    const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set (playwright.config.ts generates them)");
    return { email, password };
}

async function seriousViolations(page: Page, include?: string): Promise<string[]> {
    let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
    if (include) builder = builder.include(include);
    return (await builder.analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

async function adminPage(browser: Browser, width: number): Promise<Page> {
    const { email, password } = adminCredentials();
    const page = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width, height: 900 }, acceptDownloads: true })).newPage();
    await page.goto("/super-admin/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    return page;
}

async function ensureConfigured(page: Page) {
    await page.getByRole("link", { name: "Monetization" }).click();
    const current = page.getByRole("region", { name: "Current configuration" });
    await expect(current).toBeVisible();
    if (!(await current.textContent())?.includes("Not configured")) return;
    await page.getByRole("radio", { name: /Setting 2/ }).check();
    await page.getByRole("checkbox", { name: /Model 2/ }).check();
    await page.getByRole("button", { name: "Save configuration" }).click();
    await page.getByRole("dialog", { name: "Change monetization configuration" }).getByRole("button", { name: "Save" }).click();
    await expect(current).toContainText("Setting 2");
}

test.describe("J29 Publishing gate dry run", () => {
    test("the Super Admin reviews the ET report, downloads the CSV and signs off; the gate stays off", async ({ browser, request }) => {
        const page = await adminPage(browser, 1280);
        await ensureConfigured(page);

        await page.getByRole("link", { name: "Publishing gate" }).click();
        await expect(page.getByRole("heading", { name: "Publishing gate dry run" })).toBeVisible();
        const facts = page.getByRole("region", { name: "Report facts" });
        await expect(facts).toContainText("Publishing gate: Off");
        await expect(facts).toContainText("Cut-over: 2020-01-01T00:00:00Z");
        await expect(page.getByText("This report can't be signed off:")).toHaveCount(0);

        // the counts are the backend's
        const token = await page.evaluate(() => localStorage.getItem("adminToken"));
        const api = await (await request.get(`${BACKEND}/api/admin/publish-gate/dry-run`, { params: { market: "ET" }, headers: { Authorization: `Bearer ${token}` } })).json();
        const counts = page.getByRole("region", { name: "Counts" });
        await expect(counts.getByText("Total restaurants").locator("..")).toContainText(String(api.counts.total));
        await expect(counts.getByText("Blocked (new, no plan)").locator("..")).toContainText(String(api.counts.blocked));
        expect(await seriousViolations(page, "main")).toEqual([]);

        // review the sections the sign-off needs (U-4)
        for (const name of [/^Blocked/, /^Published menus without a plan/, /^Needs review/]) {
            await page.getByRole("button", { name }).click();
            await expect(page.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
        }

        const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download CSV (ET)" }).click()]);
        expect(download.suggestedFilename()).toBe("publish-gate-dry-run-ET.csv");
        expect(readFileSync(await download.path(), "utf8").split("\n")[0])
            .toBe("section,businessId,name,country,createdAt,ownerStatus,emailVerified,publishedMenus,plan,reason,menuId,menuName,flags");

        const trigger = page.getByRole("button", { name: /^Sign off ET/ });
        await expect(trigger).toBeEnabled();
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Sign off the ET dry run" });
        await expect(dialog).toContainText("It does not turn on publishing restrictions");
        await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
        expect(await seriousViolations(page, '[role="dialog"]')).toEqual([]);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();

        await trigger.click();
        await dialog.getByRole("checkbox", { name: "I have reviewed this report for ET" }).check();
        await dialog.getByRole("button", { name: "Sign off ET" }).click();
        const result = page.getByRole("status", { name: "Sign-off result" });
        await expect(result).toContainText("Signed off");
        await expect(result).toContainText("Valid until");
        await expect(facts).toContainText("(valid)");
        await expect(facts).toContainText("Publishing gate: Off");

        await page.getByRole("link", { name: "Audit log" }).click();
        await expect(page.getByRole("table", { name: "Audit log" })).toContainText("PUBLISH_DRY_RUN_SIGNED_OFF");
    });

    test("on a phone the page stays accessible", async ({ browser }) => {
        const page = await adminPage(browser, 375);
        await page.goto("/super-admin/publishing-gate");
        await expect(page.getByRole("region", { name: "Counts" })).toBeVisible();
        expect(await seriousViolations(page, "main")).toEqual([]);
    });
});
