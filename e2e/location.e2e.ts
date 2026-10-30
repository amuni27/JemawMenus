import { expect, test } from "@playwright/test";
import { AUTH_FILE, BUSINESS_ID, guestMenuPath, guestPage } from "./support/owner";

// AGF-S2-12 J11: the owner saves a Google Maps share link, guests get "Get Directions" instead of the address search
// link, and removing the link brings the search link back. Leaves the seeded restaurant without a link.

const LINK = "https://maps.app.goo.gl/AgafariJ11Demo";

test.describe.serial("J11 restaurant location link", () => {
    test.use({ storageState: AUTH_FILE });

    async function saveLink(page: import("@playwright/test").Page, change: (field: import("@playwright/test").Locator) => Promise<void>) {
        await page.goto(`/${BUSINESS_ID}/admin/account`);
        const card = page.locator("section, div").filter({ has: page.getByRole("heading", { name: "Business Profile" }) }).last();
        await card.getByRole("button", { name: "Edit" }).click();
        const field = page.getByPlaceholder("https://maps.app.goo.gl/…");
        await change(field);
        await page.getByRole("button", { name: "Save Changes" }).click();
        await expect(page.getByText("Business profile updated")).toBeVisible();
    }

    test("a saved link gives guests Get Directions instead of the address search", async ({ page, browser }) => {
        await saveLink(page, (field) => field.fill(LINK));
        await expect(page.getByRole("link", { name: LINK })).toBeVisible(); // account page row

        const guest = await guestPage(browser);
        await guest.goto(guestMenuPath);
        const info = guest.getByRole("region", { name: "Restaurant information" });
        const directions = info.getByRole("link", { name: "Get Directions" });
        await expect(directions).toHaveAttribute("href", LINK);
        await expect(directions).toHaveAttribute("target", "_blank");
        await expect(info.getByText("Bole Road 1", { exact: false })).toBeVisible();
        await expect(info.locator('a[href*="google.com/maps/search"]')).toHaveCount(0);
        await guest.context().close();
    });

    test("removing the link brings the address search link back", async ({ page, browser }) => {
        await saveLink(page, async () => { await page.getByRole("button", { name: "Remove link" }).click(); });

        const guest = await guestPage(browser);
        await guest.goto(guestMenuPath);
        const info = guest.getByRole("region", { name: "Restaurant information" });
        await expect(info.getByRole("link", { name: /Bole Road 1/ })).toHaveAttribute("href", /google\.com\/maps\/search/);
        await expect(info.getByRole("link", { name: "Get Directions" })).toHaveCount(0);
        await guest.context().close();
    });
});
