import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { guestMenuPath } from "./support/owner";

// AGF-S2-27 J9: guest accessibility guard. No serious or critical WCAG 2.1 A/AA violations on the guest pages at phone
// and desktop widths; item details reachable by keyboard; the waiter list behaves as a modal dialog; reflow at 320 px
// and 200 % zoom. Signed-out guest context only (no storage state).

const WIDTHS = [{ width: 375, height: 812 }, { width: 1280, height: 900 }];
const DISH = "Doro Wat"; // seeded, available, in Chef's picks and Mains

async function seriousViolations(page: Page): Promise<string[]> {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    return result.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" ; ")}`);
}

async function openGuestMenu(page: Page) {
    await page.goto(guestMenuPath);
    await expect(page.getByRole("heading", { name: DISH }).first()).toBeVisible();
}

for (const viewport of WIDTHS) {
    test.describe(`J9 guest accessibility at ${viewport.width}px`, () => {
        test.use({ viewport });

        test("guest menu, item detail and not-found have no serious or critical violations", async ({ page }) => {
            await openGuestMenu(page);
            expect(await seriousViolations(page), "guest menu").toEqual([]);

            await page.getByRole("link", { name: DISH }).first().click();
            await expect(page.getByRole("heading", { name: DISH, level: 1 })).toBeVisible();
            expect(await seriousViolations(page), "item detail").toEqual([]);

            await page.goto("/not-a-real-business/menu");
            await expect(page.getByRole("heading", { name: "We can't find this restaurant's menu" })).toBeVisible();
            expect(await seriousViolations(page), "restaurant not-found").toEqual([]);
        });

        test("the waiter list is a labelled modal dialog: focus moves in, stays in, Escape returns it", async ({ page }) => {
            await openGuestMenu(page);
            await page.getByRole("button", { name: `Add ${DISH}` }).first().click();
            const viewOrder = page.getByRole("button", { name: "View order" });
            await viewOrder.click();

            const dialog = page.getByRole("dialog", { name: "Waiter List" });
            await expect(dialog).toBeVisible();
            await expect(dialog).toHaveAttribute("aria-modal", "true");
            expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
            await expect(dialog.getByRole("button", { name: `Remove ${DISH}` })).toBeVisible();
            // the "added" toast fades in and out (index.css); axe would measure it mid-fade, so scan once it has gone
            await expect(page.locator(".animate-toast")).toHaveCount(0, { timeout: 5_000 });
            expect(await seriousViolations(page), "waiter list").toEqual([]);

            // focus stays inside while the dialog is open
            for (let i = 0; i < 12; i++) {
                await page.keyboard.press("Tab");
                expect(await dialog.evaluate((el) => el.contains(document.activeElement)), `Tab ${i + 1}`).toBe(true);
            }
            await page.keyboard.press("Shift+Tab");
            expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
            await expect(viewOrder).toBeFocused();
        });
    });
}

test.describe("J9 keyboard and reflow", () => {
    test("a dish's details open with Tab and Enter, with visible focus", async ({ page }) => {
        await openGuestMenu(page);
        const link = page.getByRole("link", { name: DISH }).first();
        for (let i = 0; i < 40 && !(await link.evaluate((el) => el === document.activeElement)); i++) {
            await page.keyboard.press("Tab");
        }
        await expect(link).toBeFocused();
        const outline = await link.evaluate((el) => {
            const s = getComputedStyle(el);
            return s.outlineStyle !== "none" || s.boxShadow !== "none";
        });
        expect(outline, "focus indicator").toBe(true);
        await page.keyboard.press("Enter");
        await expect(page.getByRole("heading", { name: DISH, level: 1 })).toBeVisible();
    });

    test("reflows at 320 px and stays usable at 200 % zoom", async ({ browser }) => {
        for (const ctxOptions of [{ viewport: { width: 320, height: 640 } }, { viewport: { width: 640, height: 450 }, deviceScaleFactor: 2 }]) {
            const page = await (await browser.newContext(ctxOptions)).newPage();
            await openGuestMenu(page);
            if (ctxOptions.deviceScaleFactor) await page.evaluate(() => { document.body.style.zoom = "2"; });
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            expect(overflow, `horizontal overflow at ${JSON.stringify(ctxOptions)}`).toBeLessThanOrEqual(1);
            await expect(page.getByRole("button", { name: "View order" })).toBeVisible();
            await expect(page.getByRole("link", { name: DISH }).first()).toBeVisible();
            await page.context().close();
        }
    });
});
