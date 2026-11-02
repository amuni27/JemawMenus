import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// AGF E4-M6 J23: grandfathering (transitions, trials and owner plan visibility on in the local E2E demo only; the daily job
// runs every few seconds there). Under Setting 2 with Models 3 and 4 two restaurants have Model 3: one with a period end a
// few seconds away, one open-ended. The admin switches to Model 4 only: the save dialog previews the change, both are
// grandfathered, the open-ended one gets a transition date (not offered on the other). The first ends at its period end
// (the job), its owner sees the ended plan, requests Model 4 and the admin fulfils it. The transition date's own end is
// covered by backend tests with a controlled clock (E2E can't wait until a restaurant-local midnight).

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

async function adminPage(browser: Browser): Promise<Page> {
    const { email, password } = adminCredentials();
    const page = await (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } })).newPage();
    await page.goto("/super-admin/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    return page;
}

async function configureSetting2(page: Page, models: string[]) {
    await page.getByRole("link", { name: "Monetization" }).click();
    await expect(page.getByRole("region", { name: "Current configuration" })).toBeVisible();
    await page.getByRole("radio", { name: /Setting 2/ }).check();
    for (const m of ["Model 2", "Model 3", "Model 4"]) {
        const box = page.getByRole("checkbox", { name: new RegExp(m) });
        if (models.includes(m)) await box.check(); else await box.uncheck();
    }
    await page.getByRole("button", { name: "Save configuration" }).click();
    return page.getByRole("dialog", { name: "Change monetization configuration" });
}

async function register(request: APIRequestContext, label: string) {
    const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const email = `${label}-${stamp}@e2e.agafari.test`;
    const password = `Aa1!${randomUUID()}`; // local, per-run test value
    const name = `${label} ${stamp}`;
    const res = await request.post("/api/auth/register", { data: {
        fullName: "Grandfathered Owner", email, password, businessName: name, businessPhone: `+2519${String(Date.now()).slice(-8)}`,
        customSubdomain: `${label}-${stamp}`.toLowerCase(), open24_7: true, country: "ET", locationUrl: "https://maps.app.goo.gl/AbC123xyz",
    } });
    expect(res.status()).toBe(201);
    const me = await request.get("/api/auth/me", { headers: { Authorization: `Bearer ${(await res.json()).token}` } });
    return { email, password, name, businessId: (await me.json()).business.id as string };
}

async function adminToken(request: APIRequestContext) {
    const res = await request.post("/api/admin/auth/login", { data: adminCredentials() });
    expect(res.status()).toBe(200);
    return (await res.json()).token as string;
}

async function openRestaurant(admin: Page, name: string) {
    await admin.getByRole("link", { name: "Subscriptions" }).click();
    await admin.getByLabel("Search restaurants").fill(name);
    await admin.getByRole("button", { name: "Search" }).click();
    await admin.getByRole("table", { name: "Restaurants" }).getByRole("button", { name: `Open ${name}` }).click();
    return admin.getByRole("region", { name: `${name} subscription` });
}

test.describe("J23 Grandfathering", () => {
    test("a plan the configuration no longer offers is grandfathered until its end, then the owner chooses an enabled plan", async ({ page, browser, request }) => {
        test.setTimeout(120_000);
        const admin = await adminPage(browser);
        const save = await configureSetting2(admin, ["Model 3", "Model 4"]);
        await save.getByRole("button", { name: "Save" }).click();
        await expect(admin.getByRole("region", { name: "Current configuration" })).toContainText("Model 3");
        const version = Number(((await admin.getByRole("region", { name: "Current configuration" }).textContent()) ?? "").match(/Version (\d+)/)?.[1]);

        const dated = await register(request, "GfDated");
        const open = await register(request, "GfOpen");
        const token = await adminToken(request);
        const periodEnd = new Date(Date.now() + 25_000).toISOString();
        for (const [r, end] of [[dated, periodEnd], [open, undefined]] as const) {
            const res = await request.post(`/api/admin/businesses/${r.businessId}/subscription`, { headers: { Authorization: `Bearer ${token}` },
                data: { planCode: "MODEL_3", expectedConfigVersion: version, ...(end ? { periodEnd: end } : {}) } });
            expect(res.status()).toBe(201);
        }

        const dialog = await configureSetting2(admin, ["Model 4"]);
        await expect(dialog).toContainText(/This change grandfathers \d+ subscriptions? \(.*Model 3: \d+/);
        await expect(dialog).toContainText("Their plans and end dates stay as they are.");
        await dialog.getByRole("button", { name: "Save" }).click();
        await expect(admin.getByRole("region", { name: "Current configuration" })).not.toContainText("Model 3");

        let detail = await openRestaurant(admin, open.name);
        await expect(detail).toContainText("Grandfathered: no end date");
        const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
        await detail.getByRole("button", { name: "Set transition date" }).click();
        const set = admin.getByRole("dialog", { name: "Set transition date" });
        await set.getByLabel("Transition date").fill(tomorrow);
        await set.getByRole("button", { name: "Set" }).click();
        await expect(detail).toContainText("(transition date)");
        expect(await seriousViolations(admin)).toEqual([]);

        detail = await openRestaurant(admin, dated.name);
        await expect(detail).toContainText("(period end)");
        await expect(detail.getByRole("button", { name: "Set transition date" })).toHaveCount(0);

        await page.goto("/auth/login");
        await page.getByPlaceholder("you@example.com").fill(dated.email);
        await page.getByPlaceholder("********").fill(dated.password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page).toHaveURL(/\/admin/);
        await page.goto(`/${dated.businessId}/admin/account`);
        const section = page.locator("#plan");
        await expect(section).toContainText("Your plan (Model 3) is no longer offered.");
        await expect(section).toContainText("Your plan (Model 3) ends in 1 day");

        // the period end passes; the job (every few seconds in the demo) ends it
        await expect(async () => {
            await page.reload();
            await expect(section).toContainText("Your previous plan (Model 3) ended on", { timeout: 2_000 });
        }).toPass({ timeout: 60_000, intervals: [3_000] });
        await expect(section).toContainText("Choose a plan to continue.");
        expect(await seriousViolations(page, "#plan")).toEqual([]);
        await section.getByRole("button", { name: "Request Model 4" }).click();
        await page.getByRole("dialog", { name: "Request a plan" }).getByRole("button", { name: "Send request" }).click();
        await expect(section).toContainText("Request for Model 4 sent");

        detail = await openRestaurant(admin, dated.name);
        await detail.getByRole("button", { name: `Fulfil request from ${dated.name}` }).click();
        await admin.getByRole("dialog", { name: "Fulfil plan request" }).getByRole("button", { name: "Fulfil" }).click();
        await expect(detail).toContainText("Model 4 · ACTIVE");
        const history = admin.getByRole("table", { name: "Subscription history" });
        await expect(history).toContainText("EXPIRED");

        await page.reload();
        await expect(section).toContainText("Model 4 · Active");
    });
});
