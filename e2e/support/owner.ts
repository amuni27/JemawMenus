import { expect, type Browser, type Page } from "@playwright/test";

// AGF-S2-28: the demo profile's seeded restaurant and owner. The password is random per run (playwright.config.ts).

export const BUSINESS_ID = "00000000-0000-4000-8000-0000000000b1";
export const OWNER_EMAIL = "owner@demo.agafari.test";
export const RESTAURANT = "Abol Demo Café";
export const AUTH_FILE = "e2e/.auth/owner.json";

export function ownerPassword(): string {
    const password = process.env.E2E_OWNER_PASSWORD;
    if (!password) throw new Error("E2E_OWNER_PASSWORD is not set (playwright.config.ts generates it)");
    return password;
}

/** Signs in through the login form and waits for the owner area. */
export async function signIn(page: Page, password = ownerPassword()): Promise<void> {
    await page.goto("/auth/login");
    await page.getByPlaceholder("you@example.com").fill(OWNER_EMAIL);
    await page.getByPlaceholder("********").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
}

/** A signed-out browser context, as a guest's phone would be. */
export async function guestPage(browser: Browser): Promise<Page> {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    return context.newPage();
}

/** Unique per run, so journeys never collide with the seed data or each other. */
export function uniqueName(prefix: string): string {
    return `${prefix} ${Date.now().toString(36)}`;
}

export const guestMenuPath = `/${BUSINESS_ID}/menu`;

export async function expectOwnerArea(page: Page): Promise<void> {
    await expect(page).toHaveURL(new RegExp(`/${BUSINESS_ID}/admin`));
}
