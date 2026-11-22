import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// AGF Self-Service Phase A J26: owners start Free with Ads themselves. Runs in the isolated ads project (demo backend 8082,
// frontend 5177) after J24 and J25, with owner plans and self-service also on there (local demo only). Setting 2 with
// Models 2, 3, 4 and an active Agafari ad. Owner A starts Free with Ads from Subscription & Plans (approved wording) and
// the guest menu shows the Agafari ad. Owner B has a pending Ad-Free request: "Keep my request" changes nothing; the
// explicit "Withdraw request and start free" withdraws it and starts Free with Ads. Paid plans can't be started; a Free
// with Ads request points to self-service. Verification is operational in this demo (local outbox), so it is required
// (SS-2): an unverified owner is refused until the outbox link verifies the email.

function adminCredentials() {
    const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) throw new Error("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set (playwright.config.ts generates them)");
    return { email, password };
}

async function seriousViolations(page: Page, include?: string): Promise<string[]> {
    let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
    if (include) builder = builder.include(include);
    return (await builder.analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
}

type Restaurant = { businessId: string; email: string; password: string; auth: Record<string, string> };

async function restaurantWithMenu(request: APIRequestContext, label: string): Promise<Restaurant> {
    const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const email = `${label}-${stamp}@e2e.agafari.test`.toLowerCase(), password = `Aa1!${randomUUID()}`; // local, per-run test values
    const res = await request.post("/api/auth/register", { data: {
        fullName: "Self-service Owner", email, password, businessName: `${label} ${stamp}`, businessPhone: `+2519${String(Date.now()).slice(-8)}`,
        customSubdomain: `${label}-${stamp}`.toLowerCase(), open24_7: true, country: "ET", locationUrl: "https://maps.app.goo.gl/AbC123xyz",
    } });
    expect(res.status()).toBe(201);
    const auth = { Authorization: `Bearer ${(await res.json()).token}` };
    const businessId = (await (await request.get("/api/auth/me", { headers: auth })).json()).business.id as string;
    const types = (await (await request.get("/api/menus/type/all", { headers: auth })).json()) as { id: string; name: string }[];
    const created = await request.post("/api/menus", { headers: auth, data: { name: "Lunch", menuTypeId: types[0].id, isActive: true } });
    expect(created.status()).toBe(201);
    const menu = await created.json();
    const category = await request.post(`/api/menus/${menu.id}/categories`, { headers: auth, data: { name: "Mains" } });
    const item = await request.post(`/api/menus/${menu.id}/items`, { headers: auth,
        data: { categoryId: (await category.json()).id, name: "Doro Wat", price: 420, ingredients: ["chicken"] } });
    expect(item.status()).toBe(201);
    expect((await request.patch(`/api/menus/${menu.id}`, { headers: auth, data: { visibility: "PUBLIC" } })).status()).toBe(200);
    return { businessId, email, password, auth };
}

/** SS-2: the demo outbox holds the verification link; following it verifies the owner's email. */
async function verifyEmail(request: APIRequestContext, r: Restaurant) {
    const box = await request.get(`/api/demo/email-verification-outbox?email=${encodeURIComponent(r.email)}`);
    expect(box.status()).toBe(200);
    const token = new URL((await box.json()).verifyUrl).hash.replace(/^#token=/, ""); // the token travels in the fragment
    expect((await request.post("/api/auth/verify-email", { data: { token } })).status()).toBe(200);
}

async function ownerPlansPage(browser: Browser, r: Restaurant): Promise<Page> {
    const page = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } })).newPage();
    await page.goto("/auth/login");
    await page.getByPlaceholder("you@example.com").fill(r.email);
    await page.getByPlaceholder("********").fill(r.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.getByRole("link", { name: "Subscription & Plans" }).click();
    await expect(page.getByRole("heading", { name: "Subscription & Plans" })).toBeVisible();
    return page;
}

const card = (page: Page, name: string) => page.getByRole("region", { name: "Available plans" }).getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });

test.describe("J26 self-service Free with Ads", () => {
    test("an owner starts Free with Ads themselves; a pending request is withdrawn only after explicit confirmation", async ({ page, browser, request }) => {
        const token = (await (await request.post("/api/admin/auth/login", { data: adminCredentials() })).json()).token as string;
        const admin = { Authorization: `Bearer ${token}` };
        const current = await (await request.get("/api/admin/monetization-config", { headers: admin })).json();
        let version = current.version as number;
        if (!(current.setting === "SETTING_2" && ["MODEL_2", "MODEL_3", "MODEL_4"].every((m) => current.models.includes(m)))) {
            const saved = await request.put("/api/admin/monetization-config", { headers: admin,
                data: { setting: "SETTING_2", models: ["MODEL_2", "MODEL_3", "MODEL_4"], expectedVersion: version } });
            expect(saved.status()).toBe(200);
            version = (await saved.json()).version;
        }
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        expect((await request.post("/api/admin/ads", { headers: admin, data: { title: "Self-service coffee", body: "Fresh roast", linkUrl: "https://example.test/ss",
            startLocal: `${yesterday}T00:00`, timeZone: "UTC" } })).status()).toBe(201);

        // Owner A: Start free from Subscription & Plans
        const a = await restaurantWithMenu(request, "SelfA");
        await verifyEmail(request, a);
        const ownerA = await ownerPlansPage(browser, a);
        await expect(card(ownerA, "Free with Ads").getByRole("button", { name: "Start free" })).toBeVisible();
        await expect(card(ownerA, "Free with Ads").getByRole("button", { name: /^Request / })).toHaveCount(0);
        await expect(card(ownerA, "Ad-Free").getByRole("button")).toHaveCount(0); // AGF F5: no paid-plan request
        await expect(card(ownerA, "Ad-Free")).toContainText("Payment not available yet");
        expect(await seriousViolations(ownerA, "#plan")).toEqual([]);
        await card(ownerA, "Free with Ads").getByRole("button", { name: "Start free" }).click();
        const dialog = ownerA.getByRole("dialog", { name: "Start Free with Ads?" });
        await expect(dialog).toContainText("Agafari will show one sponsored item on your guest menu. There's no charge.");
        await expect(dialog).toContainText("To change your plan later, contact the Agafari team.");
        expect(await seriousViolations(ownerA, '[role="dialog"]')).toEqual([]);
        await dialog.getByRole("button", { name: "Start free" }).click();
        const section = ownerA.locator("#plan");
        await expect(section).toContainText("Free with Ads · Active");
        await expect(section).toContainText("Started by you");
        await expect(section.getByRole("button", { name: "Start free" })).toHaveCount(0);
        const adminView = await (await request.get(`/api/admin/businesses/${a.businessId}/subscription`, { headers: admin })).json();
        expect(adminView.current.source).toBe("OWNER");
        expect(adminView.current.sourceLabel).toBe("Self-service (owner), no payment");
        await page.goto(`/${a.businessId}/menu`);
        await expect(page.getByRole("region", { name: "Sponsored" })).toContainText("Self-service coffee"); // entitlements follow at once

        // Owner B: a pending Ad-Free request is withdrawn only after explicit confirmation
        const b = await restaurantWithMenu(request, "SelfB");
        await verifyEmail(request, b);
        const ownerB = await ownerPlansPage(browser, b);
        // AGF F5: an existing paid request (made through the unchanged API; the page no longer offers one)
        const v = (await (await request.get("/api/plan", { headers: b.auth })).json()).configVersion as number;
        expect((await request.post("/api/plan/requests", { headers: b.auth, data: { planCode: "MODEL_4", expectedConfigVersion: v } })).status()).toBe(201);
        await ownerB.reload();
        await expect(ownerB.locator("#plan")).toContainText("Request for Ad-Free sent on");
        const free = card(ownerB, "Free with Ads");
        await expect(free).toContainText("You have a pending request for Ad-Free. Starting Free with Ads will withdraw it.");
        await free.getByRole("button", { name: "Start free" }).click();
        let confirm = ownerB.getByRole("dialog", { name: "Start Free with Ads and withdraw your request for Ad-Free?" });
        await expect(confirm.getByRole("button", { name: "Keep my request" })).toBeFocused();
        await confirm.getByRole("button", { name: "Keep my request" }).click();
        await expect(ownerB.locator("#plan")).toContainText("Request for Ad-Free sent on"); // nothing changed
        await free.getByRole("button", { name: "Start free" }).click();
        confirm = ownerB.getByRole("dialog", { name: "Start Free with Ads and withdraw your request for Ad-Free?" });
        await confirm.getByRole("button", { name: "Withdraw request and start free" }).click();
        await expect(ownerB.locator("#plan")).toContainText("Free with Ads · Active");
        await expect(ownerB.locator("#plan")).not.toContainText("Request for Ad-Free sent on");

        // SS-2: unverified is refused while verification is operational; paid plans can't be started; a Free with Ads request
        // points to self-service
        const c = await restaurantWithMenu(request, "SelfC");
        const unverified = await request.post("/api/plan/activations", { headers: c.auth, data: { planCode: "MODEL_2", expectedConfigVersion: version } });
        expect(unverified.status()).toBe(403);
        expect((await unverified.json()).code).toBe("EMAIL_NOT_VERIFIED");
        await verifyEmail(request, c);
        const paid = await request.post("/api/plan/activations", { headers: c.auth, data: { planCode: "MODEL_4", expectedConfigVersion: version } });
        expect(paid.status()).toBe(400);
        expect((await paid.json()).code).toBe("PLAN_REQUIRES_PAYMENT");
        const freeRequest = await request.post("/api/plan/requests", { headers: c.auth, data: { planCode: "MODEL_2", expectedConfigVersion: version } });
        expect(freeRequest.status()).toBe(409);
        expect((await freeRequest.json()).code).toBe("USE_SELF_SERVICE");
    });
});
