import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// AGF FE-2 J28 (backend BE-5a; register §49/§50): plan selection after sign-in. Runs against its own local demo backend
// (8083) and frontend (5178) where the cut-over is configured and every restaurant counts as new, so J1–J27 keep the
// cut-over unset and prove that existing navigation is unchanged. Nothing is ever activated automatically: the owner
// chooses explicitly; the step is skippable (Q8) and menus can be prepared meanwhile; a return page always wins.

const BACKEND = "http://127.0.0.1:8083";
const BANNER = "Choose how you'd like to start";

type Owner = { email: string; password: string; token: string; businessId: string };

function adminCredentials() {
    const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set (playwright.config.ts generates them)");
    return { email, password };
}

async function seriousViolations(page: Page, include?: string): Promise<string[]> {
    let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
    if (include) builder = builder.include(include);
    const result = await builder.analyze();
    return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} (${n.any.map((c) => c.message).join("; ")})`).join(" | ")}`);
}

async function freshPage(browser: Browser): Promise<Page> {
    return (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 375, height: 812 } })).newPage();
}

async function configure(browser: Browser, setting: 1 | 2) {
    const { email, password } = adminCredentials();
    const page = await freshPage(browser);
    await page.goto("/super-admin/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await page.getByRole("link", { name: "Monetization" }).click();
    const current = page.getByRole("region", { name: "Current configuration" });
    await expect(current).toBeVisible();
    if ((await current.textContent())?.includes(`Setting ${setting}`)) return page.context().close();
    await page.getByRole("radio", { name: new RegExp(`Setting ${setting}`) }).check();
    if (setting === 2) {
        for (const [m, on] of [["2", true], ["3", false], ["4", true]] as const) {
            const box = page.getByRole("checkbox", { name: new RegExp(`Model ${m}`) });
            if (on) await box.check(); else if (await box.isChecked()) await box.uncheck();
        }
    }
    await page.getByRole("button", { name: "Save configuration" }).click();
    await page.getByRole("dialog", { name: "Change monetization configuration" }).getByRole("button", { name: "Save" }).click();
    await expect(current).toContainText(`Setting ${setting}`);
    await page.context().close();
}

async function register(request: APIRequestContext, label: string): Promise<Owner> {
    const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const email = `${label}-${stamp}@e2e.agafari.test`, password = `Aa1!${randomUUID()}`; // local, per-run test values
    const res = await request.post("/api/auth/register", { data: {
        fullName: "Onboarding Owner", email, password, businessName: `${label} ${stamp}`, businessPhone: `+2519${String(Date.now()).slice(-8)}`,
        customSubdomain: `${label}-${stamp}`, open24_7: true, country: "ET", locationUrl: "https://maps.app.goo.gl/AbC123xyz",
    } });
    expect(res.status()).toBe(201);
    const token = (await res.json()).token as string;
    const businessId = (await (await request.get("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })).json()).business.id as string;
    return { email, password, token, businessId };
}

async function verifyEmail(request: APIRequestContext, o: Owner) {
    const box = await request.get(`${BACKEND}/api/demo/email-verification-outbox`, { params: { email: o.email } });
    expect(box.status()).toBe(200);
    const token = new URL((await box.json()).verifyUrl).hash.replace(/^#token=/, "");
    expect((await request.post("/api/auth/verify-email", { data: { token } })).status()).toBe(200);
}

async function signIn(page: Page, o: Owner) {
    await page.getByPlaceholder("you@example.com").fill(o.email);
    await page.getByPlaceholder("********").fill(o.password);
    await page.getByRole("button", { name: "Sign in" }).click();
}

async function signInFresh(browser: Browser, o: Owner): Promise<Page> {
    const page = await freshPage(browser);
    await page.goto("/auth/login");
    await signIn(page, o);
    return page;
}

const reminder = (page: Page) => page.getByRole("status", { name: "Plan reminder" });
const card = (page: Page, name: string) => page.getByRole("region", { name: "Available plans" }).getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });

test.describe("J28 Plan selection after sign-in", () => {
    test("Setting 1: a new owner lands on Subscription & Plans, can prepare menus first, then verifies and starts the trial; later sign-ins land on Menus", async ({ browser, request }) => {
        await configure(browser, 1);
        const owner = await register(request, "onb-trial");

        const page = await signInFresh(browser, owner);
        await expect(page).toHaveURL(new RegExp(`/${owner.businessId}/admin/plans$`));
        const banner = page.getByRole("region", { name: BANNER });
        await expect(banner).toContainText("You can prepare your menus meanwhile.");
        const offer = page.getByRole("region", { name: "Free trial" });
        await expect(offer).toContainText("Verify your email to start your free trial."); // verification is never bypassed
        await expect(page.locator("#plan")).not.toContainText("days left"); // nothing was activated
        expect(await seriousViolations(page)).toEqual([]);

        // Q8 skippable: menus stay reachable and drafts can be prepared while the choice is pending
        await banner.getByRole("link", { name: "Continue to my menus" }).click();
        await expect(page).toHaveURL(new RegExp(`/${owner.businessId}/admin/menus$`));
        await expect(reminder(page)).toContainText("Choose how your restaurant starts on Agafari.");
        const types = (await (await request.get("/api/menus/type/all", { headers: { Authorization: `Bearer ${owner.token}` } })).json()) as { id: string }[];
        expect((await request.post("/api/menus", { headers: { Authorization: `Bearer ${owner.token}` }, data: { name: "Draft", menuTypeId: types[0].id, isActive: true } })).status()).toBe(201);
        // the reminder FE-2 adds (the Menus page's existing brand buttons have a known contrast finding, outside FE-2)
        expect(await seriousViolations(page, '[aria-label="Plan reminder"]')).toEqual([]);

        await verifyEmail(request, owner);
        await reminder(page).getByRole("link", { name: "Go to Subscription & Plans" }).click();
        await page.reload(); // the session's verification state
        await offer.getByRole("button", { name: "Start free trial" }).click();
        await page.getByRole("dialog", { name: "Start your 30-day free trial?" }).getByRole("button", { name: "Start free trial" }).click();
        await expect(page.locator("#plan").getByRole("status")).toContainText("Your free trial has started.");
        await expect(page.getByRole("region", { name: BANNER })).toHaveCount(0);

        const planRead = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/plan");
        await page.goto(`/${owner.businessId}/admin/menus`); // phone width: the sidebar links are off-screen
        expect((await planRead).status()).toBe(200);
        await expect(page.getByRole("heading", { name: "Menus" })).toBeVisible();
        await expect(reminder(page)).toHaveCount(0);

        const again = await signInFresh(browser, owner);
        await expect(again).toHaveURL(new RegExp(`/${owner.businessId}/admin/menus$`));
        await expect(reminder(again)).toHaveCount(0);
    });

    test("Setting 2: the owner dismisses the reminder for the session, then starts Free with Ads; later sign-ins land on Menus", async ({ browser, request }) => {
        await configure(browser, 2);
        const owner = await register(request, "onb-free");
        await verifyEmail(request, owner);

        const page = await signInFresh(browser, owner);
        await expect(page).toHaveURL(/\/admin\/plans$/);
        await page.getByRole("region", { name: BANNER }).getByRole("link", { name: "Continue to my menus" }).click();
        await expect(reminder(page)).toBeVisible();
        await page.getByRole("button", { name: "Dismiss plan reminder" }).click();
        await expect(reminder(page)).toHaveCount(0);
        const planRead = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/plan");
        await page.reload();
        expect((await planRead).status()).toBe(200);
        await expect(page.getByRole("heading", { name: "Menus" })).toBeVisible();
        await expect(reminder(page)).toHaveCount(0); // dismissed for this browser session

        await page.goto(`/${owner.businessId}/admin/plans`);
        await expect(page.getByRole("region", { name: BANNER })).toBeVisible(); // the page still says so until a choice is made
        await card(page, "Free with Ads").getByRole("button", { name: "Start free" }).click();
        await page.getByRole("dialog", { name: "Start Free with Ads?" }).getByRole("button", { name: "Start free" }).click();
        await expect(page.locator("#plan")).toContainText("Free with Ads · Active");
        await expect(page.getByRole("region", { name: BANNER })).toHaveCount(0);

        const again = await signInFresh(browser, owner);
        await expect(again).toHaveURL(/\/admin\/menus$/);
        await expect(reminder(again)).toHaveCount(0);
    });

    test("Setting 2: a paid plan request counts as chosen and activates nothing; later sign-ins land on Menus", async ({ browser, request }) => {
        await configure(browser, 2);
        const owner = await register(request, "onb-paid");

        const page = await signInFresh(browser, owner);
        await expect(page).toHaveURL(/\/admin\/plans$/);
        // AGF F5: the page offers no paid-plan request now; an existing one (unchanged API) still counts as chosen
        await expect(card(page, "Ad-Free")).toContainText("Payment not available yet");
        await expect(card(page, "Ad-Free").getByRole("button")).toHaveCount(0);
        const auth = { Authorization: `Bearer ${owner.token}` };
        const v = (await (await request.get("/api/plan", { headers: auth })).json()).configVersion as number;
        expect((await request.post("/api/plan/requests", { headers: auth, data: { planCode: "MODEL_4", expectedConfigVersion: v } })).status()).toBe(201);
        await page.reload();
        await expect(page.locator("#plan")).toContainText("Request for Ad-Free sent on");
        await expect(page.locator("#plan")).not.toContainText("· Active");
        await expect(page.getByRole("region", { name: BANNER })).toHaveCount(0);

        const again = await signInFresh(browser, owner);
        await expect(again).toHaveURL(/\/admin\/menus$/);
        await expect(reminder(again)).toHaveCount(0);
    });

    test("a return page wins over the plan step, and the reminder is shown there", async ({ browser, request }) => {
        await configure(browser, 2);
        const owner = await register(request, "onb-next");

        const page = await freshPage(browser);
        await page.goto(`/${owner.businessId}/admin/qrcode`);
        await expect(page).toHaveURL(/\/auth\/login\?/);
        await signIn(page, owner);
        await expect(page).toHaveURL(new RegExp(`/${owner.businessId}/admin/qrcode$`));
        await expect(reminder(page)).toBeVisible();
    });
});
