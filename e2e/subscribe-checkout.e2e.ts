import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// AGF F4 J33 (register §84 D6): the Stripe Checkout UI against the real backend while billing is off, as everywhere today
// (no stubs, D-S2-28-2). Runs in the ads project (owner plans and self-service on) after J26. The real plan view has no
// prices and no checkoutAvailable, so a paid plan keeps "Request" and never shows "Subscribe"; the checkout API answers 404;
// and Stripe's return and cancel pages render safely without a checkout. The checkout flows themselves are Vitest-covered.

function adminCredentials() {
    const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set (playwright.config.ts generates them)");
    return { email, password };
}

async function seriousViolations(page: Page): Promise<string[]> {
    return (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations
        .filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
}

const card = (page: Page, name: string) => page.getByRole("region", { name: "Available plans" }).getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
const NO_CHECKOUT = "We couldn't find a payment started in this browser. Your plan's state is on Subscription & Plans.";

test.describe("J33 Subscribe while billing is off", () => {
    test("paid plans keep Request, the checkout API is closed, and the return and cancel pages are safe without a checkout", async ({ browser, request }) => {
        const token = (await (await request.post("/api/admin/auth/login", { data: adminCredentials() })).json()).token as string;
        const admin = { Authorization: `Bearer ${token}` };
        const current = await (await request.get("/api/admin/monetization-config", { headers: admin })).json();
        if (!(current.setting === "SETTING_2" && ["MODEL_2", "MODEL_4"].every((m) => current.models.includes(m)))) {
            const saved = await request.put("/api/admin/monetization-config", { headers: admin,
                data: { setting: "SETTING_2", models: ["MODEL_2", "MODEL_3", "MODEL_4"], expectedVersion: current.version } });
            expect(saved.status()).toBe(200);
        }

        const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
        const email = `checkout-${stamp}@e2e.agafari.test`, password = `Aa1!${randomUUID()}`; // local, per-run test values
        const reg = await request.post("/api/auth/register", { data: {
            fullName: "Checkout Owner", email, password, businessName: `Checkout ${stamp}`, businessPhone: `+2519${String(Date.now()).slice(-8)}`,
            customSubdomain: `checkout-${stamp}`, open24_7: true, country: "ET", locationUrl: "https://maps.app.goo.gl/AbC123xyz",
        } });
        expect(reg.status()).toBe(201);
        const auth = { Authorization: `Bearer ${(await reg.json()).token}` };
        const businessId = (await (await request.get("/api/auth/me", { headers: auth })).json()).business.id as string;

        // the real backend: billing off, so no prices, no availability, and no checkout
        const view = await (await request.get("/api/plan", { headers: auth })).json();
        expect(view.visible).toBe(true);
        expect(view).not.toHaveProperty("prices");
        expect(view).not.toHaveProperty("checkoutAvailable");
        const refused = await request.post("/api/billing/checkouts", { headers: { ...auth, "Idempotency-Key": `j33-${stamp}` }, data: { priceId: "none" } });
        expect(refused.status()).toBe(404);

        const page = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } })).newPage();
        await page.goto("/auth/login");
        await page.getByPlaceholder("you@example.com").fill(email);
        await page.getByPlaceholder("********").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page).toHaveURL(/\/admin/);
        await page.goto(`/${businessId}/admin/plans`);
        await expect(page.getByRole("heading", { name: "Subscription & Plans" })).toBeVisible();
        await expect(card(page, "Ad-Free").getByRole("button", { name: "Request Ad-Free" })).toBeVisible();
        await expect(card(page, "Free with Ads").getByRole("button", { name: "Start free" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Subscribe" })).toHaveCount(0);
        await expect(page.getByText("Pricing will be announced.").first()).toBeVisible();

        for (const width of [1280, 375]) {
            await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
            for (const path of ["/billing/return?session=cs_test_synthetic", "/billing/cancelled"]) {
                await page.goto(path);
                await expect(page.getByRole("heading", { level: 1 })).toHaveText(NO_CHECKOUT);
                const back = page.getByRole("link", { name: "Go to Subscription & Plans" });
                await expect(back).toHaveAttribute("href", `/${businessId}/admin/plans`);
                expect(await seriousViolations(page)).toEqual([]);
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            }
        }
        await page.getByRole("link", { name: "Go to Subscription & Plans" }).click();
        await expect(page.getByRole("heading", { name: "Subscription & Plans" })).toBeVisible();
        expect((await (await request.get("/api/plan", { headers: auth })).json()).current ?? null).toBeNull();

        // signed out, the pages send the visitor to login
        const guest = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
        await guest.goto("/billing/return");
        await expect(guest).toHaveURL(/\/auth\/login/);
    });
});
