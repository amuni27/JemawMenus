import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE, BUSINESS_ID, guestMenuPath } from "./support/owner";

// AGF-S2-25 J14: specials. The owner puts a seeded dish on special through the Specials page; a guest on a phone
// (375 px) sees the Specials section, the special price with the regular price struck through and the "Special"
// badge, with no serious or critical accessibility violations; when the owner pauses it, guests see the regular
// price again. The special is deleted at the end so other journeys see the seed as it was.

const DISH = "Beef Tibs"; // seeded at ETB 380.00, available, in Mains

async function seriousViolations(page: Page): Promise<string[]> {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.help}`);
}

async function specialsPage(page: Page) {
    await page.goto(`/${BUSINESS_ID}/admin/specials`);
    await expect(page.getByRole("heading", { level: 2, name: "Specials" })).toBeVisible();
}

const specialCard = (page: Page) => page.getByRole("list", { name: "Specials" }).getByRole("listitem").filter({ hasText: DISH });

test.describe.serial("J14 specials", () => {
    test("the owner adds a special for a dish", async ({ browser }) => {
        const context = await browser.newContext({ storageState: AUTH_FILE });
        const page = await context.newPage();
        await specialsPage(page);
        await page.getByRole("button", { name: "Add special" }).click();
        const dialog = page.locator("div.fixed.inset-0 > div");
        await dialog.getByLabel("Dish").selectOption({ label: `${DISH} · ETB 380.00` });
        await dialog.getByLabel("Special price (ETB)").fill("300");
        await dialog.getByLabel("Note (optional)").fill("Grill night");
        await dialog.getByRole("button", { name: "Add special" }).click();
        await expect(specialCard(page)).toContainText("Active now");
        await expect(specialCard(page)).toContainText("ETB 300.00");
        await context.close();
    });

    test.describe("on a phone", () => {
        test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, storageState: { cookies: [], origins: [] } });

        test("a guest sees the Specials section and the special price, accessibly", async ({ page }) => {
            await page.goto(guestMenuPath);
            const section = page.getByRole("region", { name: "Specials" });
            await expect(section).toBeVisible();
            const card = section.getByRole("article").filter({ hasText: DISH });
            await expect(card).toContainText("300.00");
            await expect(card.locator("s")).toContainText("380.00");
            await expect(card).toContainText("Special");
            await expect(section).toContainText("Grill night");
            // the dish's own card in Mains shows the special too
            const mains = page.getByRole("main").locator("section").filter({ has: page.getByRole("heading", { level: 2, name: "Mains" }) });
            await expect(mains.getByRole("article").filter({ hasText: DISH }).locator("s")).toContainText("380.00");
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            expect(await seriousViolations(page), "guest menu with a special").toEqual([]);
        });
    });

    test("when the owner pauses it, guests see the regular price", async ({ browser }) => {
        const context = await browser.newContext({ storageState: AUTH_FILE });
        const page = await context.newPage();
        await specialsPage(page);
        await specialCard(page).getByRole("button", { name: "Pause" }).click();
        await expect(specialCard(page)).toContainText("Paused");

        const guest = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
        await guest.goto(guestMenuPath);
        await expect(guest.getByRole("main").getByRole("heading", { level: 3, name: DISH }).first()).toBeVisible();
        await expect(guest.getByRole("region", { name: "Specials" })).toHaveCount(0);
        await expect(guest.getByRole("main").getByRole("article").filter({ hasText: DISH }).first().locator("s")).toHaveCount(0);
        await guest.context().close();

        // clean up for other journeys
        await specialCard(page).getByRole("button", { name: "Delete" }).click();
        await page.getByRole("button", { name: "Delete special" }).click();
        await expect(page.getByText(/No specials yet/)).toBeVisible();
        await context.close();
    });
});
