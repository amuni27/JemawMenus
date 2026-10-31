import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE, BUSINESS_ID, guestMenuPath, uniqueName } from "./support/owner";

// AGF-S2-23 J13: bilingual menus. The owner adds a dish with an Amharic name in the item form; a guest on a phone
// (375 px) sees the "English | አማርኛ" switch, chooses Amharic (translated names in Amharic, untranslated ones in
// English), keeps the choice after a reload, searches in Amharic and opens a dish in Amharic. The demo seed has
// Amharic for some dishes (Doro Wat, Shiro Wat, coffee) and the "Mains" and "Drinks" categories.

const SEEDED_MENU = "00000000-0000-4000-8000-0000000000e1";
const dishName = uniqueName("E2E Gomen");
const dishNameAm = `ጎመን ${Date.now().toString(36)}`;

function field(page: Page, label: string) {
    return page.getByText(label, { exact: true }).locator("..").locator("input");
}

test.describe.serial("J13 bilingual menu", () => {
    test("the owner adds a dish with an Amharic name", async ({ browser }) => {
        const context = await browser.newContext({ storageState: AUTH_FILE });
        const page = await context.newPage();
        await page.goto(`/${BUSINESS_ID}/admin/menus/${SEEDED_MENU}`);
        await page.getByRole("button", { name: "+ Add Item" }).click();
        await field(page, "Name").fill(dishName);
        await page.getByLabel("Name in Amharic (optional)").fill(dishNameAm);
        await page.locator("div.fixed.inset-0 > div").getByLabel("Category").selectOption({ label: "Mains" });
        await field(page, "Price (ETB)").fill("150");
        await page.getByRole("textbox", { name: "Add ingredient" }).fill("collard greens");
        await page.getByRole("textbox", { name: "Add ingredient" }).press("Enter");
        await page.getByRole("button", { name: "Create", exact: true }).click();
        await expect(page.getByRole("list", { name: "Items" }).getByRole("heading", { name: dishName })).toBeVisible();
        await context.close();
    });

    test.describe("on a phone", () => {
        test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, storageState: { cookies: [], origins: [] } });

        test("a guest switches to Amharic, keeps it, searches and opens a dish in Amharic", async ({ page }) => {
            await page.goto(guestMenuPath);
            const languages = page.getByRole("group", { name: "Menu language" });
            await expect(languages).toBeVisible();
            await expect(languages.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
            const main = page.getByRole("main");
            await expect(main.getByRole("heading", { level: 3, name: "Doro Wat" }).first()).toBeVisible(); // also in Chef's picks

            await languages.getByRole("button", { name: "አማርኛ" }).click();
            await expect(languages.getByRole("button", { name: "አማርኛ" })).toHaveAttribute("aria-pressed", "true");
            await expect(main.getByRole("heading", { level: 3, name: "ዶሮ ወጥ" }).first()).toBeVisible();
            await expect(main.getByRole("heading", { level: 3, name: dishNameAm })).toBeVisible(); // added by the owner
            await expect(main.getByRole("heading", { level: 3, name: "Beef Tibs" })).toBeVisible(); // untranslated
            await expect(main.getByRole("heading", { level: 2, name: "ዋና ምግቦች" })).toBeVisible();
            await expect(main.locator('[lang="am"]').first()).toBeVisible();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

            await page.reload();
            await expect(page.getByRole("main").getByRole("heading", { level: 3, name: "ዶሮ ወጥ" }).first()).toBeVisible(); // remembered

            await page.getByRole("button", { name: "Search menu", exact: true }).click();
            await page.getByRole("searchbox", { name: "Search menu items" }).fill("ዶሮ");
            const results = page.getByRole("main").getByRole("heading", { level: 3 });
            await expect(results.first()).toHaveText("ዶሮ ወጥ");
            for (const text of await results.allTextContents()) expect(text.trim()).toBe("ዶሮ ወጥ"); // only Doro Wat matches

            await page.getByRole("main").getByRole("link", { name: "ዶሮ ወጥ" }).first().click();
            await expect(page.getByRole("heading", { name: "ዶሮ ወጥ" }).first()).toBeVisible();
            await expect(page.getByText("በበርበሬ የተሰራ የዶሮ ወጥ ከእንቁላል እና ከእንጀራ ጋር").first()).toBeVisible();
        });
    });
});
