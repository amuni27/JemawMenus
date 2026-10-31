import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE, BUSINESS_ID, guestMenuPath } from "./support/owner";

// AGF-S2-36 J15: category specials. The owner puts the seeded Mains category on 20 % off and Beef Tibs on its own
// special. A guest on a phone (375 px) sees the discounted Doro Wat price, the heading badge and one Specials line
// for Mains, while Beef Tibs keeps its dish special (never stacked), with no serious or critical accessibility
// violations. When the owner pauses the category special, Doro Wat is back to its regular price. Both specials are
// deleted at the end so other journeys see the seed as it was. J14 is unchanged.

const CATEGORY = "Mains";
const DORO = "Doro Wat"; // seeded at ETB 420.00, available, in Mains → 336.00 at 20 %
const TIBS = "Beef Tibs"; // seeded at ETB 380.00, available, in Mains → dish special 300.00 wins over 304.00

async function seriousViolations(page: Page): Promise<string[]> {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.help}`);
}

async function specialsPage(page: Page) {
    await page.goto(`/${BUSINESS_ID}/admin/specials`);
    await expect(page.getByRole("heading", { level: 2, name: "Specials" })).toBeVisible();
}

const cards = (page: Page) => page.getByRole("list", { name: "Specials" }).getByRole("listitem");
const categoryCard = (page: Page) => cards(page).filter({ hasText: "Category special" });
const dishCard = (page: Page) => cards(page).filter({ hasText: TIBS });
const dialog = (page: Page) => page.locator("div.fixed.inset-0 > div");
const mainsSection = (page: Page) => page.getByRole("main").locator("section").filter({ has: page.getByRole("heading", { level: 2, name: CATEGORY }) });

test.describe.serial("J15 category specials", () => {
    test("the owner adds a category special and a dish special in the same category", async ({ browser }) => {
        const context = await browser.newContext({ storageState: AUTH_FILE });
        const page = await context.newPage();
        await specialsPage(page);

        await page.getByRole("button", { name: "Add category special" }).click();
        await expect(dialog(page)).toContainText("Dishes with their own special keep it.");
        await dialog(page).getByLabel("Category").selectOption({ label: CATEGORY });
        await dialog(page).getByLabel("Discount (%)").fill("20");
        await dialog(page).getByLabel("Note (optional)").fill("Lunch deal");
        await dialog(page).getByRole("button", { name: "Add category special" }).click();
        await expect(categoryCard(page)).toContainText("20% off");
        await expect(categoryCard(page)).toContainText("Active now");

        await page.getByRole("button", { name: "Add special", exact: true }).click();
        await dialog(page).getByLabel("Dish").selectOption({ label: `${TIBS} · ETB 380.00` });
        await dialog(page).getByLabel("Special price (ETB)").fill("300");
        await dialog(page).getByRole("button", { name: "Add special" }).click();
        await expect(dishCard(page)).toContainText("ETB 300.00");
        await context.close();
    });

    test.describe("on a phone", () => {
        test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, storageState: { cookies: [], origins: [] } });

        test("a guest sees the category discount, the badge and one Specials line; the dish special wins", async ({ page }) => {
            await page.goto(guestMenuPath);
            const mains = mainsSection(page);
            await expect(mains).toContainText("20% off");
            await expect(mains).toContainText("Lunch deal");
            const doro = mains.getByRole("article").filter({ hasText: DORO });
            await expect(doro).toContainText("336.00");
            await expect(doro.locator("s")).toContainText("420.00");
            const tibs = mains.getByRole("article").filter({ hasText: TIBS });
            await expect(tibs).toContainText("300.00"); // its own special, not 304.00 and not 240.00
            await expect(tibs).not.toContainText("304.00");

            const section = page.getByRole("region", { name: "Specials" });
            await expect(section.getByRole("button", { name: `${CATEGORY} · 20% off` })).toBeVisible();
            await expect(section.getByRole("article")).toHaveCount(1); // Beef Tibs only: no card per discounted dish
            await expect(section.getByRole("article")).toContainText(TIBS);

            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            expect(await seriousViolations(page), "guest menu with a category special").toEqual([]);
        });
    });

    test("when the owner pauses the category special, guests see regular prices again", async ({ browser }) => {
        const context = await browser.newContext({ storageState: AUTH_FILE });
        const page = await context.newPage();
        await specialsPage(page);
        await categoryCard(page).getByRole("button", { name: "Pause" }).click();
        await expect(categoryCard(page)).toContainText("Paused");

        const guest = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
        await guest.goto(guestMenuPath);
        const mains = mainsSection(guest);
        await expect(mains.getByRole("article").filter({ hasText: DORO })).toBeVisible();
        await expect(mains.getByRole("article").filter({ hasText: DORO }).locator("s")).toHaveCount(0);
        await expect(mains).not.toContainText("20% off");
        await expect(mains.getByRole("article").filter({ hasText: TIBS })).toContainText("300.00"); // the dish special stays
        await guest.context().close();

        // clean up for other journeys
        for (const card of [categoryCard(page), dishCard(page)]) {
            await card.getByRole("button", { name: "Delete" }).click();
            await page.getByRole("button", { name: "Delete special" }).click();
            await expect(card).toHaveCount(0);
        }
        await expect(page.getByText(/No specials yet/)).toBeVisible();
        await context.close();
    });
});
