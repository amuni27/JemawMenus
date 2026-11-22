import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { AUTH_FILE, BUSINESS_ID } from "./support/owner";

// AGF FE-R2 J32 (backend R5-03-D): the owner's Notices section on Subscription & Plans against the real backend (no stubs,
// D-S2-28-2). The demo profile has no billing, so the real notice API answers with an empty list; the notice wording itself is
// covered by Vitest (PO decision, register §81).

test.describe("J32 owner notices", () => {
    test.use({ storageState: AUTH_FILE });

    for (const width of [1280, 375]) {
        test(`the real notice list loads, shows its empty state and is accessible at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
            const response = page.waitForResponse((r) => r.url().endsWith("/api/plan/notices") && r.request().method() === "GET");
            await page.goto(`/${BUSINESS_ID}/admin/plans`);
            const res = await response;
            expect(res.status()).toBe(200);
            expect(await res.json()).toEqual([]);
            const section = page.getByRole("region", { name: "Notices" });
            await expect(section).toBeVisible();
            await expect(section).toContainText("No notices yet.");
            const axe = await new AxeBuilder({ page }).include("#plan").withTags(["wcag2a", "wcag2aa"]).analyze();
            expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
        });
    }
});
