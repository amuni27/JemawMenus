import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE, BUSINESS_ID } from "./support/owner";

// AGF-S2-35 J12 (Defect F2): the owner's Account & Settings page fits a phone. Before the fix, the cards' grid had no
// mobile column, so the guest menu link's full width (≈470 px) widened the page to ~684 px at 375 px: sideways
// scrolling, Edit buttons off-screen and the profile editor partly out of view. Desktop keeps two columns.

test.use({ storageState: AUTH_FILE });

const pageWidth = (page: Page) => page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
}));

async function openAccount(page: Page) {
    await page.goto(`/${BUSINESS_ID}/admin/account`);
    await expect(page.getByRole("heading", { name: "Business Profile" })).toBeVisible();
}

for (const width of [375, 320]) {
    test.describe(`J12 account page at ${width}px`, () => {
        // Phone emulation: like a real phone, a too-wide page widens the layout viewport (and shifts fixed dialogs)
        test.use({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });

        test("no sideways scroll; Edit buttons, guest link and Copy link fit", async ({ page }) => {
            await openAccount(page);
            const { scroll, viewport } = await pageWidth(page);
            expect(viewport).toBe(width);
            expect(scroll).toBeLessThanOrEqual(viewport);

            const edits = page.getByRole("button", { name: "Edit" });
            expect(await edits.count()).toBeGreaterThanOrEqual(4);
            for (const edit of await edits.all()) {
                const box = (await edit.boundingBox())!;
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(width);
            }

            const guestRow = page.getByText("Guest menu link", { exact: true }).locator("..");
            const link = guestRow.getByRole("link");
            expect(await link.evaluate((a) => a.scrollWidth > a.clientWidth)).toBe(true); // truncated with an ellipsis
            const copy = (await guestRow.getByRole("button", { name: "Copy link" }).boundingBox())!;
            expect(copy.x + copy.width).toBeLessThanOrEqual(width);
        });

        test("the Edit Business Profile dialog opens inside the screen", async ({ page }) => {
            await openAccount(page);
            const card = page.locator("div").filter({ has: page.getByRole("heading", { name: "Business Profile" }) }).last();
            await card.getByRole("button", { name: "Edit" }).click({ timeout: 5_000 }); // fails when the button is off-screen
            const dialog = page.locator("div.fixed.inset-0 > div").filter({ has: page.getByText("Edit Business Profile") });
            await expect(dialog).toBeVisible();
            const box = (await dialog.boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width);
        });
    });
}

test.describe("J12 account page on a desktop", () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("keeps the two-column layout", async ({ page }) => {
        await openAccount(page);
        const user = (await page.getByRole("heading", { name: "User Profile" }).boundingBox())!;
        const business = (await page.getByRole("heading", { name: "Business Profile" }).boundingBox())!;
        expect(Math.abs(user.y - business.y)).toBeLessThan(2); // side by side
        expect(business.x).toBeGreaterThan(user.x + 200);
    });
});
