import { expect, test, type Locator, type Page } from "@playwright/test";
import { AUTH_FILE, BUSINESS_ID, guestMenuPath, guestPage, uniqueName } from "./support/owner";
import { randomSecret } from "./support/runEnv.mjs";

// AGF-S2-12 J11 + CR1: the restaurant's location follows its country.
// - Ethiopia (the seeded restaurant): the owner saves a Google Maps link, guests get "Get Directions" instead of the
//   address search; the link can be replaced but not removed (D-CR1-5).
// - Registration on a phone (375 px): Ethiopia shows only the required link; switching to the United States shows
//   street, city, state and ZIP; an Ethiopian restaurant registers with just the link.
// - Registration on a desktop: a US restaurant registers with its address and no link; its owner adds a link and
//   removes it again, and guests get the address search link back. AGF-S2-26: the time zone is pre-selected from the
//   state, and guests see "open now" for New York time (fixed browser clock, winter and summer).

const LINK = "https://maps.app.goo.gl/AgafariJ11Demo";
const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 900 };

/** Wizard fields: the label sits next to its input (the wizard's Input has no label association). */
const field = (page: Page, label: string): Locator => page.getByText(label, { exact: true }).locator("..").locator("input");

async function personalStep(page: Page, email: string, password: string) {
    await page.goto("/auth/register");
    await field(page, "Full Name *").fill("J11 Owner");
    await field(page, "Email *").fill(email);
    await page.locator("input[type=password]").nth(0).fill(password);
    await page.locator("input[type=password]").nth(1).fill(password);
    await page.getByRole("button", { name: "Next" }).click();
}

async function finishRegistration(page: Page, shortName: string) {
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Open 24/7").check();
    await field(page, "Restaurant short name *").fill(shortName);
    await page.getByRole("button", { name: "Complete Signup" }).click();
    await expect(page.getByText("Registration successful!")).toBeVisible();
}

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe.serial("J11 restaurant location: Ethiopia (seeded restaurant)", () => {
    test.use({ storageState: AUTH_FILE });

    async function editLink(page: Page, saved?: string) {
        await page.goto(`/${BUSINESS_ID}/admin/account`);
        // the account page refreshes the stored session; open the editor once it shows the saved link
        if (saved) await expect(page.getByRole("link", { name: saved })).toBeVisible();
        const card = page.locator("section, div").filter({ has: page.getByRole("heading", { name: "Business Profile" }) }).last();
        await card.getByRole("button", { name: "Edit" }).click();
        return page.getByPlaceholder("https://maps.app.goo.gl/…");
    }

    test("a saved link gives guests Get Directions instead of the address search", async ({ page, browser }) => {
        await (await editLink(page)).fill(LINK);
        await page.getByRole("button", { name: "Save Changes" }).click();
        await expect(page.getByText("Business profile updated")).toBeVisible();
        await expect(page.getByRole("link", { name: LINK })).toBeVisible(); // account page row

        const guest = await guestPage(browser);
        await guest.goto(guestMenuPath);
        const info = guest.getByRole("region", { name: "Restaurant information" });
        const directions = info.getByRole("link", { name: "Get Directions" });
        await expect(directions).toHaveAttribute("href", LINK);
        await expect(directions).toHaveAttribute("target", "_blank");
        await expect(info.locator('a[href*="google.com/maps/search"]')).toHaveCount(0);
        await guest.context().close();
    });

    test("the link can be replaced but not removed", async ({ page }) => {
        const input = await editLink(page, LINK);
        await expect(input).toHaveValue(LINK);
        await expect(page.getByRole("button", { name: "Remove link" })).toHaveCount(0);
        await input.fill("");
        await page.getByRole("button", { name: "Save Changes" }).click();
        await expect(page.getByText(/need a Google Maps link/)).toBeVisible();

        await input.fill("https://goo.gl/maps/J11Replaced");
        await page.getByRole("button", { name: "Save Changes" }).click();
        await expect(page.getByText("Business profile updated")).toBeVisible();
        await expect(page.getByRole("link", { name: "https://goo.gl/maps/J11Replaced" })).toBeVisible();
    });
});

test.describe("J11 registration by country", () => {
    test("on a phone: Ethiopia needs only the link, the United States the address; switching swaps them", async ({ browser }) => {
        const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: PHONE });
        const page = await context.newPage();
        const id = uniqueName("et").replace(/\W+/g, "");
        await personalStep(page, `${id}@j11.test`, `${randomSecret(16)}Aa1!`);

        const country = page.getByLabel("Country *");
        await expect(country).toHaveValue("ET");
        await expect(page.getByText("Google Maps link *")).toBeVisible();
        await expect(page.getByRole("link", { name: "Find Location on Google Maps" })).toHaveAttribute("target", "_blank");
        for (const label of ["Street Address *", "City *", "State *", "ZIP Code *"]) await expect(page.getByText(label, { exact: true })).toHaveCount(0);

        await country.selectOption("US");
        for (const label of ["Street Address *", "City *", "State *", "ZIP Code *", "Google Maps link (optional)"]) {
            await expect(page.getByText(label, { exact: true })).toBeVisible();
        }
        expect(await noHorizontalScroll(page)).toBe(true);

        await country.selectOption("ET");
        await field(page, "Business Name *").fill("J11 Addis Cafe");
        await page.getByPlaceholder("Enter business phone number").fill("+251911223344");
        await expect(page.getByRole("button", { name: "Next" })).toBeDisabled(); // the link is required
        await field(page, "Google Maps link *").fill(LINK);
        expect(await noHorizontalScroll(page)).toBe(true);
        await finishRegistration(page, id);
        await context.close();
    });

    test("on a desktop: a US restaurant registers with its address and zone; its owner adds and removes a link", async ({ browser, request }) => {
        const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: DESKTOP });
        const page = await context.newPage();
        const id = uniqueName("us").replace(/\W+/g, "");
        const email = `${id}@j11.test`;
        const password = `${randomSecret(16)}Aa1!`;
        await personalStep(page, email, password);

        await page.getByLabel("Country *").selectOption("US");
        await field(page, "Business Name *").fill("J11 Empire Diner");
        await page.getByPlaceholder("Enter business phone number").fill("+12125550100");
        await field(page, "Street Address *").fill("350 5th Ave");
        await field(page, "City *").fill("New York");
        await page.getByLabel("State *").selectOption("NY");
        await expect(page.getByLabel("Time zone *")).toHaveValue("America/New_York"); // AGF-S2-26: from the state
        await field(page, "ZIP Code *").fill("1011");
        await expect(page.getByText(/12345 or 12345-6789/)).toBeVisible();
        await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
        await field(page, "ZIP Code *").fill("10118");
        await finishRegistration(page, id);

        // Sign in as the new owner
        await page.getByPlaceholder("you@example.com").fill(email);
        await page.getByPlaceholder("********").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page).toHaveURL(/\/admin/);
        const businessId = new URL(page.url()).pathname.split("/")[1];

        await page.goto(`/${businessId}/admin/account`);
        await expect(page.getByText("United States")).toBeVisible();
        const card = page.locator("section, div").filter({ has: page.getByRole("heading", { name: "Business Profile" }) }).last();
        await card.getByRole("button", { name: "Edit" }).click();
        await page.getByPlaceholder("https://maps.app.goo.gl/…").fill(LINK);
        await page.getByRole("button", { name: "Save Changes" }).click();
        await expect(page.getByText("Business profile updated")).toBeVisible();

        const guest = await guestPage(browser);
        await guest.goto(`/${businessId}/menu`);
        const info = guest.getByRole("region", { name: "Restaurant information" });
        await expect(info.getByRole("link", { name: "Get Directions" })).toHaveAttribute("href", LINK);
        await expect(info.getByText("350 5th Ave, New York, NY")).toBeVisible();

        await card.getByRole("button", { name: "Edit" }).click();
        await page.getByRole("button", { name: "Remove link" }).click();
        await page.getByRole("button", { name: "Save Changes" }).click();
        await expect(page.getByText("Business profile updated").last()).toBeVisible();

        await guest.reload();
        await expect(info.getByRole("link", { name: /350 5th Ave/ })).toHaveAttribute("href", /google\.com\/maps\/search/);
        await expect(info.getByRole("link", { name: "Get Directions" })).toHaveCount(0);
        await guest.context().close();

        // AGF-S2-26: weekday hours 09:00–17:00; guests see the status for New York time, not Addis Ababa time
        const token = (await (await request.post("/api/auth/login", { data: { email, password } })).json()).token;
        const weekday = (day: string) => ({ dayOfWeek: day, isOpen: true, startTime: "09:00", endTime: "17:00" });
        const hours = await request.patch(`/api/business/${businessId}/hours`, {
            headers: { Authorization: `Bearer ${token}` },
            data: { open24_7: false, businessHours: [...["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map(weekday),
                ...["SATURDAY", "SUNDAY"].map((day) => ({ dayOfWeek: day, isOpen: false, startTime: null, endTime: null }))] },
        });
        expect(hours.ok()).toBe(true);
        for (const [instant, expected] of [
            ["2026-01-14T15:00:00Z", /^Open now/],   // Wednesday 10:00 in New York (18:00 in Addis Ababa)
            ["2026-01-14T23:00:00Z", /^Closed/],     // Wednesday 18:00 in New York
            ["2026-07-15T14:00:00Z", /^Open now/],   // Wednesday 10:00 in New York, daylight saving
        ] as const) {
            const timed = await guestPage(browser);
            await timed.clock.setFixedTime(new Date(instant));
            await timed.goto(`/${businessId}/menu`);
            await expect(timed.getByRole("region", { name: "Restaurant information" }).getByText(expected)).toBeVisible();
            await timed.context().close();
        }
        await context.close();
    });
});
