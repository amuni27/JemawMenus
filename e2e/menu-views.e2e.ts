import { expect, test } from "@playwright/test";
import { AUTH_FILE, BUSINESS_ID, RESTAURANT, guestPage, guestMenuPath } from "./support/owner";

// AGF-S2-24 J16: menu views. A guest opening the menu raises today's count on the owner's dashboard, and the guest
// menu footer shows the menu-views privacy notice.

test.describe("J16 menu views", () => {
    test.use({ storageState: AUTH_FILE });

    test("a guest opening the menu raises today's views on the dashboard", async ({ page, browser }) => {
        const today = page.getByTestId("views-today");
        await page.goto(`/${BUSINESS_ID}/admin`);
        await expect(page.getByRole("heading", { name: "Menu views" })).toBeVisible();
        await expect(today).toHaveText(/^\d+$/);
        const before = Number(await today.textContent());

        const guest = await guestPage(browser);
        await guest.goto(guestMenuPath);
        await expect(guest.getByText(RESTAURANT).first()).toBeVisible();
        await guest.close();

        await page.reload();
        await expect(today).toHaveText(/^\d+$/);
        expect(Number(await today.textContent())).toBeGreaterThan(before);
        await expect(page.getByText("Counts how often your guest menu was opened, including reloads. Not unique visitors.")).toBeVisible();
    });

    test("the guest menu footer opens the menu-views privacy notice", async ({ browser }) => {
        const guest = await guestPage(browser);
        await guest.goto(guestMenuPath);
        await guest.getByRole("contentinfo").getByRole("button", { name: "Privacy" }).click();
        const notice = guest.getByRole("dialog", { name: "Menu views" });
        await expect(notice).toContainText("We don't use cookies for this and don't store your IP address");
        await guest.keyboard.press("Escape");
        await expect(notice).toBeHidden();
        await guest.close();
    });
});
