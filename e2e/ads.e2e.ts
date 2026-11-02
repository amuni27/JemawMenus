import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// AGF E4-M7 J24: Agafari ads (Model 2). Runs in its own local demo backend (8082) and frontend (5177) with entitlements and
// Agafari ads on; J1–J23 keep their flags. The admin sets Setting 2 (Models 2, 4); a Model 2 and a Model 4 restaurant each
// get a published menu; the admin creates a text-only ad in an explicit time zone; the Model 2 guest menu shows one
// "Sponsored" slot before the categories with a new-tab sponsored link; the Model 4 menu shows none; pausing removes it; the
// console shows served impressions. Images and schedule edge cases are covered by backend and unit tests (no R2 here).

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

async function restaurantWithMenu(request: APIRequestContext, label: string) {
    const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const res = await request.post("/api/auth/register", { data: {
        fullName: "Ads Owner", email: `${label}-${stamp}@e2e.agafari.test`, password: `Aa1!${randomUUID()}`, businessName: `${label} ${stamp}`,
        businessPhone: `+2519${String(Date.now()).slice(-8)}`, customSubdomain: `${label}-${stamp}`.toLowerCase(), open24_7: true, country: "ET",
        locationUrl: "https://maps.app.goo.gl/AbC123xyz",
    } });
    expect(res.status()).toBe(201);
    const auth = { Authorization: `Bearer ${(await res.json()).token}` };
    const businessId = (await (await request.get("/api/auth/me", { headers: auth })).json()).business.id as string;
    const types = (await (await request.get("/api/menus/type/all", { headers: auth })).json()) as { id: string; name: string }[];
    const lunch = types.find((t) => t.name.toLowerCase() === "lunch") ?? types[0];
    const created = await request.post("/api/menus", { headers: auth, data: { name: "Lunch", menuTypeId: lunch.id, isActive: true } });
    expect(created.status()).toBe(201);
    const menu = await created.json();
    const category = await request.post(`/api/menus/${menu.id}/categories`, { headers: auth, data: { name: "Mains" } });
    expect(category.status()).toBe(201);
    const item = await request.post(`/api/menus/${menu.id}/items`, { headers: auth,
        data: { categoryId: (await category.json()).id, name: "Doro Wat", price: 420, ingredients: ["chicken"] } });
    expect(item.status()).toBe(201);
    expect((await request.patch(`/api/menus/${menu.id}`, { headers: auth, data: { visibility: "PUBLIC" } })).status()).toBe(200); // published for guests
    return businessId;
}

test.describe("J24 Agafari ads", () => {
    test("a Model 2 guest menu shows one sponsored ad, a Model 4 menu shows none, and pausing removes it", async ({ page, browser, request }) => {
        const admin = await adminPage(browser);
        await admin.getByRole("link", { name: "Monetization" }).click();
        await admin.getByRole("radio", { name: /Setting 2/ }).check();
        for (const [m, on] of [["Model 2", true], ["Model 3", false], ["Model 4", true]] as const) {
            const box = admin.getByRole("checkbox", { name: new RegExp(m) });
            if (on) await box.check(); else await box.uncheck();
        }
        await admin.getByRole("button", { name: "Save configuration" }).click();
        await admin.getByRole("dialog", { name: "Change monetization configuration" }).getByRole("button", { name: "Save" }).click();
        const current = admin.getByRole("region", { name: "Current configuration" });
        await expect(current).toContainText("Model 2");
        const version = Number(((await current.textContent()) ?? "").match(/Version (\d+)/)?.[1]);

        const model2 = await restaurantWithMenu(request, "AdsTwo");
        const model4 = await restaurantWithMenu(request, "AdsFour");
        const token = (await (await request.post("/api/admin/auth/login", { data: adminCredentials() })).json()).token as string;
        for (const [id, plan] of [[model2, "MODEL_2"], [model4, "MODEL_4"]] as const) {
            expect((await request.post(`/api/admin/businesses/${id}/subscription`, { headers: { Authorization: `Bearer ${token}` },
                data: { planCode: plan, expectedConfigVersion: version } })).status()).toBe(201);
        }

        await admin.getByRole("link", { name: "Ads" }).click();
        await admin.getByRole("button", { name: "New ad" }).click();
        const dialog = admin.getByRole("dialog", { name: "New ad" });
        await dialog.getByLabel("Title", { exact: true }).fill("Coffee week");
        await dialog.getByLabel("Text", { exact: true }).fill("Try the new roast");
        await dialog.getByLabel("Link (https)").fill("https://example.test/coffee");
        await dialog.getByLabel("Time zone").selectOption("UTC");
        await expect(dialog.getByLabel("Start (UTC)")).toBeVisible(); // the zone is shown beside the field
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        await dialog.getByLabel("Start (UTC)").fill(`${yesterday}T00:00`);
        await dialog.getByRole("button", { name: "Save" }).click();
        const table = admin.getByRole("table", { name: "Agafari ads" });
        await expect(table).toContainText("Coffee week");
        await expect(table).toContainText("Active");
        expect(await seriousViolations(admin)).toEqual([]);

        await page.goto(`/${model2}/menu`);
        const slot = page.getByRole("region", { name: "Sponsored" });
        await expect(slot).toContainText("Coffee week");
        const link = slot.getByRole("link", { name: /Coffee week/ });
        await expect(link).toHaveAttribute("href", "https://example.test/coffee");
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", "sponsored noopener noreferrer");
        const category = page.getByRole("heading", { name: "Mains" }).last();
        expect(await slot.evaluate((el, cat) => Boolean(el.compareDocumentPosition(cat as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await category.elementHandle()))
            .toBe(true);
        expect(await seriousViolations(page)).toEqual([]);

        await page.goto(`/${model4}/menu`);
        await expect(page.getByRole("heading", { name: "Mains" }).last()).toBeVisible();
        await expect(page.getByRole("region", { name: "Sponsored" })).toHaveCount(0);

        await admin.reload();
        await admin.getByRole("button", { name: "Pause Coffee week" }).click();
        await expect(admin.getByRole("table", { name: "Agafari ads" })).toContainText("Paused");
        await page.goto(`/${model2}/menu`);
        await expect(page.getByRole("heading", { name: "Mains" }).last()).toBeVisible();
        await expect(page.getByRole("region", { name: "Sponsored" })).toHaveCount(0);

        await admin.reload();
        const served = Number((await admin.getByRole("table", { name: "Agafari ads" }).getByRole("row").nth(1).getByRole("cell").nth(3).textContent()) ?? "0");
        expect(served).toBeGreaterThanOrEqual(1);
    });
});
