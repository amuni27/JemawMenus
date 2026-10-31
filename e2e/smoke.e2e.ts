import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE, BUSINESS_ID, RESTAURANT, expectOwnerArea, guestMenuPath, guestPage, signIn, uniqueName } from "./support/owner";

// AGF-S2-28: owner → guest smoke journeys (proposal §4) against the real backend in its demo profile.
// Owner steps use the signed-in session from auth.setup; guest steps use a fresh signed-out context.

/** Value field that follows a visible label (several form inputs have a visible label without an accessible name). */
function field(page: Page, label: string) {
    return page.getByText(label, { exact: true }).locator("xpath=..").locator("input, textarea").first();
}

test.describe("J1 owner sign-in and sign-out", () => {
    test("a wrong password stays on the login page; the right one opens the owner area; sign-out returns to login", async ({ page }) => {
        await signIn(page, "definitely-not-the-password");
        await expect(page).toHaveURL(/\/auth\/login/);
        await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

        await signIn(page);
        await expectOwnerArea(page);
        await expect(page.getByText(RESTAURANT).first()).toBeVisible();

        await page.getByRole("button", { name: /owner@demo\.agafari\.test/ }).click();
        await page.getByRole("button", { name: "Sign out" }).click();
        await expect(page).toHaveURL(/\/auth\/login/);
    });
});

test.describe.serial("J2–J6 a menu from creation to guests and back", () => {
    test.use({ storageState: AUTH_FILE });

    const menuName = uniqueName("E2E Menu");
    const itemName = uniqueName("E2E Tibs");
    let menuUrl = "";

    /** The guest page with this run's menu chosen in the menu picker (or null when guests can't pick it). */
    async function openGuestMenu(guest: Page): Promise<boolean> {
        await guest.goto(guestMenuPath);
        await expect(guest.getByText(RESTAURANT).first()).toBeVisible();
        await guest.getByRole("button", { name: "Select menu category" }).click();
        const option = guest.getByRole("button", { name: menuName }).or(guest.getByRole("option", { name: menuName }));
        if (!(await option.first().isVisible().catch(() => false))) return false;
        await option.first().click();
        return true;
    }

    test("J2 owner builds a menu: it starts unpublished, with a category and an item", async ({ page }) => {
        await page.goto(`/${BUSINESS_ID}/admin/menus/new`);
        await field(page, "Menu Name").fill(menuName);
        await page.getByRole("combobox", { name: "Menu Type" }).selectOption({ label: "Lunch" });
        await expect(page.getByRole("checkbox", { name: "Published" })).not.toBeChecked(); // PO-2
        await page.getByRole("button", { name: "Save Menu" }).click();

        await page.goto(`/${BUSINESS_ID}/admin/menus`);
        await page.getByRole("link", { name: menuName }).first().click();
        await expect(page.getByRole("heading", { name: menuName, level: 2 })).toBeVisible();
        await expect(page.getByText("Unpublished").first()).toBeVisible();
        menuUrl = page.url();

        await page.getByRole("button", { name: "+ Add Category" }).click();
        await field(page, "Name").fill("Mains");
        await page.getByRole("button", { name: "Create", exact: true }).click();
        await expect(page.getByRole("list", { name: "Categories" }).getByText("Mains")).toBeVisible();

        await page.getByRole("button", { name: "+ Add Item" }).click();
        await field(page, "Name").fill(itemName);
        await field(page, "Price (ETB)").fill("385");
        await page.getByRole("textbox", { name: "Add ingredient" }).fill("beef");
        await page.getByRole("textbox", { name: "Add ingredient" }).press("Enter");
        await page.getByRole("button", { name: "Add eggs" }).click();
        await page.getByRole("button", { name: "Create", exact: true }).click();
        await expect(page.getByRole("list", { name: "Items" }).getByRole("heading", { name: itemName })).toBeVisible();
    });

    test("J3 guests can't see the unpublished menu; the owner preview shows it", async ({ page, browser }) => {
        const guest = await guestPage(browser);
        expect(await openGuestMenu(guest)).toBe(false);
        await expect(guest.getByText(itemName)).toHaveCount(0);

        await page.goto(menuUrl);
        await page.getByRole("link", { name: "Preview" }).click();
        await expect(page.getByRole("region", { name: "Preview" })).toContainText("not visible to guests", { ignoreCase: true });
        await expect(page.getByRole("heading", { name: itemName })).toBeVisible();
    });

    test("J4 once published, guests see the menu, find the item by search and open its details", async ({ page, browser }) => {
        await page.goto(menuUrl);
        await page.getByRole("button", { name: "Publish" }).click();
        await expect(page.getByText("Live").first()).toBeVisible();

        const guest = await guestPage(browser);
        expect(await openGuestMenu(guest)).toBe(true);
        await expect(guest.getByRole("heading", { name: itemName })).toBeVisible();

        await guest.getByRole("searchbox", { name: "Search menu items" }).fill(itemName.split(" ").pop()!);
        await expect(guest.getByRole("heading", { name: itemName })).toBeVisible();

        await guest.getByRole("heading", { name: itemName }).click();
        // the detail view opens over the list (its card stays in the page underneath), so take the detail's own,
        // later copy of the price and the allergen under its Allergens heading
        await expect(guest.getByRole("heading", { name: itemName, level: 1 })).toBeVisible();
        await expect(guest.getByText("ETB 385.00").last()).toBeVisible();
        await expect(guest.getByRole("heading", { name: "Allergens" })).toBeVisible();
        await expect(guest.getByText("eggs", { exact: true }).last()).toBeVisible();
    });

    test("J5 sold out shows as Sold Out to guests; Mark all available brings it back", async ({ page, browser }) => {
        await page.goto(menuUrl);
        const card = page.getByRole("list", { name: "Items" }).getByRole("listitem").filter({ hasText: itemName });
        await card.getByRole("button", { name: "Mark sold out" }).click();
        await expect(card.getByText("Sold out")).toBeVisible();

        const guest = await guestPage(browser);
        await openGuestMenu(guest);
        await expect(guest.getByRole("button", { name: `${itemName} is sold out` })).toBeDisabled();

        await page.getByRole("button", { name: "Mark all available" }).click();
        await page.getByRole("dialog", { name: "Mark all available" }).getByRole("button", { name: "Mark available" }).click();
        await expect(card.getByText("Available")).toBeVisible();

        await openGuestMenu(guest);
        await expect(guest.getByRole("button", { name: `Add ${itemName}` })).toBeEnabled();
    });

    test("J6 unpublishing hides the menu from guests again; the item's address shows the friendly not-found", async ({ page, browser }) => {
        const guest = await guestPage(browser);
        await openGuestMenu(guest);
        await guest.getByRole("heading", { name: itemName }).click();
        const itemUrl = guest.url();

        await page.goto(menuUrl);
        await page.getByRole("button", { name: "Unpublish" }).click();
        await expect(page.getByText("Unpublished").first()).toBeVisible();

        expect(await openGuestMenu(guest)).toBe(false);
        await guest.goto(itemUrl);
        await expect(guest.getByRole("heading", { name: "This dish isn't on the menu right now" })).toBeVisible();
    });
});

test.describe("J7 QR code address", () => {
    test.use({ storageState: AUTH_FILE });

    test("the QR page shows the configured guest address, and that address opens the guest menu", async ({ page, browser, baseURL }) => {
        await page.goto(`/${BUSINESS_ID}/admin/qrcode`);
        const expected = `${baseURL}/${BUSINESS_ID}/menu`;
        const link = page.getByRole("link", { name: expected });
        await expect(link).toHaveAttribute("href", expected);

        const guest = await guestPage(browser);
        await guest.goto(expected);
        await expect(guest.getByText(RESTAURANT).first()).toBeVisible();
        await expect(guest.getByRole("searchbox", { name: "Search menu items" })).toBeVisible();
    });
});

test.describe("J8 guards and not-found pages", () => {
    test("signed out: admin pages go to login, unknown pages and restaurants show friendly screens", async ({ browser }) => {
        const guest = await guestPage(browser);

        await guest.goto(`/${BUSINESS_ID}/admin/menus`);
        await expect(guest).toHaveURL(/\/auth\/login/);

        await guest.goto("/auth/nope");
        await expect(guest.getByRole("heading", { name: "We can't find that page" })).toBeVisible();

        await guest.goto("/not-a-real-business/menu");
        await expect(guest.getByRole("heading", { name: "We can't find this restaurant's menu" })).toBeVisible();
    });
});
