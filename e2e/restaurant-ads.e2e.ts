import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// AGF E4-M8 J25: restaurant-managed ads (Model 3). Runs in the isolated ads project (demo backend 8082, frontend 5177, with
// entitlements, Agafari ads and restaurant ads on) after J24; J1–J23 keep their flags. The admin enables Models 2, 3 and 4;
// two Model 3 restaurants, a Model 2 and a Model 4 restaurant each get a published menu. A Model 3 owner creates an ad in the
// owner console (restaurant time zone, preview); each Model 3 guest menu shows only its own ad, with the Model 3 privacy
// sentence; the Model 2 and Model 4 menus show no restaurant ad and a Model 2 owner can't create one. The Super Admin
// suspends the ad with a reason: it disappears, the owner sees the reason, can't resume it, and archives it.

const MODEL3_NOTICE = "This menu may display sponsored content managed by the restaurant. Agafari does not track your clicks or collect personal information for these advertisements.";

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

async function newPage(browser: Browser): Promise<Page> {
    return (await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } })).newPage();
}

async function adminPage(browser: Browser): Promise<Page> {
    const { email, password } = adminCredentials();
    const page = await newPage(browser);
    await page.goto("/super-admin/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    return page;
}

type Restaurant = { businessId: string; email: string; password: string; auth: Record<string, string> };

async function restaurantWithMenu(request: APIRequestContext, label: string): Promise<Restaurant> {
    const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const email = `${label}-${stamp}@e2e.agafari.test`.toLowerCase(), password = `Aa1!${randomUUID()}`; // local, per-run test values
    const res = await request.post("/api/auth/register", { data: {
        fullName: "Ads Owner", email, password, businessName: `${label} ${stamp}`, businessPhone: `+2519${String(Date.now()).slice(-8)}`,
        customSubdomain: `${label}-${stamp}`.toLowerCase(), open24_7: true, country: "ET", locationUrl: "https://maps.app.goo.gl/AbC123xyz",
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
    expect((await request.patch(`/api/menus/${menu.id}`, { headers: auth, data: { visibility: "PUBLIC" } })).status()).toBe(200);
    return { businessId, email, password, auth };
}

async function privacyText(page: Page): Promise<string> {
    await page.getByRole("button", { name: "Privacy" }).click();
    const text = (await page.getByRole("dialog", { name: "Menu views" }).textContent()) ?? "";
    await page.keyboard.press("Escape");
    return text;
}

test.describe("J25 restaurant ads", () => {
    test("a Model 3 owner's ad shows only on its own menu, never on other models, and a suspension takes it down", async ({ page, browser, request }) => {
        const admin = await adminPage(browser);
        await admin.getByRole("link", { name: "Monetization" }).click();
        await admin.getByRole("radio", { name: /Setting 2/ }).check();
        for (const m of ["Model 2", "Model 3", "Model 4"]) await admin.getByRole("checkbox", { name: new RegExp(m) }).check();
        await admin.getByRole("button", { name: "Save configuration" }).click();
        await admin.getByRole("dialog", { name: "Change monetization configuration" }).getByRole("button", { name: "Save" }).click();
        const current = admin.getByRole("region", { name: "Current configuration" });
        await expect(current).toContainText("Model 3");
        const version = Number(((await current.textContent()) ?? "").match(/Version (\d+)/)?.[1]);

        const a = await restaurantWithMenu(request, "RestA"), b = await restaurantWithMenu(request, "RestB");
        const m2 = await restaurantWithMenu(request, "RestTwo"), m4 = await restaurantWithMenu(request, "RestFour");
        const token = (await (await request.post("/api/admin/auth/login", { data: adminCredentials() })).json()).token as string;
        for (const [r, plan] of [[a, "MODEL_3"], [b, "MODEL_3"], [m2, "MODEL_2"], [m4, "MODEL_4"]] as const) {
            expect((await request.post(`/api/admin/businesses/${r.businessId}/subscription`, { headers: { Authorization: `Bearer ${token}` },
                data: { planCode: plan, expectedConfigVersion: version } })).status()).toBe(201);
        }
        const yesterday = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);

        // Owner A creates an ad in the owner console
        const owner = await newPage(browser);
        await owner.goto("/auth/login");
        await owner.getByPlaceholder("you@example.com").fill(a.email);
        await owner.getByPlaceholder("********").fill(a.password);
        await owner.getByRole("button", { name: "Sign in" }).click();
        await expect(owner).toHaveURL(/\/admin/);
        await owner.getByRole("link", { name: "Ads", exact: true }).click();
        await owner.getByRole("button", { name: "New ad" }).click();
        const dialog = owner.getByRole("dialog", { name: "New ad" });
        await expect(dialog.getByLabel("Time zone")).toHaveCount(0); // the restaurant's own zone
        await dialog.getByLabel("Title", { exact: true }).fill("House tibs");
        await dialog.getByLabel("Text", { exact: true }).fill("Our weekend special");
        await dialog.getByLabel("Link (https)").fill("https://example.test/tibs");
        await dialog.getByLabel("Start (Africa/Addis_Ababa)").fill(`${yesterday}T09:00`);
        await expect(dialog.getByRole("region", { name: "Sponsored" })).toContainText("House tibs"); // preview
        await dialog.getByRole("button", { name: "Save" }).click();
        const table = owner.getByRole("table", { name: "Your ads" });
        await expect(table).toContainText("House tibs");
        await expect(table).toContainText("Active");
        expect(await seriousViolations(owner)).toEqual([]);

        // Owner B creates one through the API; a Model 2 owner can't
        const input = (title: string) => ({ title, body: "Text", linkUrl: "https://example.test/b", startLocal: `${yesterday}T09:00` });
        expect((await request.post("/api/restaurant-ads", { headers: b.auth, data: input("B coffee") })).status()).toBe(201);
        expect((await request.post("/api/restaurant-ads", { headers: m2.auth, data: input("Not allowed") })).status()).toBe(403);

        // Guests: each Model 3 menu shows only its own ad
        await page.goto(`/${a.businessId}/menu`);
        const slot = page.getByRole("region", { name: "Sponsored" });
        await expect(slot).toContainText("House tibs");
        await expect(slot).not.toContainText("B coffee");
        const link = slot.getByRole("link", { name: /House tibs/ });
        await expect(link).toHaveAttribute("href", "https://example.test/tibs");
        await expect(link).toHaveAttribute("rel", "sponsored noopener noreferrer");
        // AD "Visit advertiser": one link with a visible cue and a clear name (title, cue, new-tab note), reachable by keyboard
        await expect(slot.getByRole("link")).toHaveCount(1);
        await expect(link.getByText("Visit advertiser")).toBeVisible();
        await expect(link).toHaveAccessibleName("House tibs Visit advertiser (opens in a new tab)");
        await link.focus();
        await expect(link).toBeFocused();
        // AD-D1 layout: the card spans the menu column (no extra inset) and leaves section spacing before the next heading
        const column = await page.locator("main").boundingBox(), card = await slot.boundingBox();
        const nextHeading = await page.getByRole("heading", { name: "Mains" }).last().boundingBox();
        expect(Math.abs(card!.x - column!.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(card!.width - column!.width)).toBeLessThanOrEqual(1);
        expect(nextHeading!.y - (card!.y + card!.height)).toBeGreaterThanOrEqual(32);
        expect(await privacyText(page)).toContain(MODEL3_NOTICE);
        expect(await seriousViolations(page)).toEqual([]);
        await page.goto(`/${b.businessId}/menu`);
        await expect(page.getByRole("region", { name: "Sponsored" })).toContainText("B coffee");
        await expect(page.getByRole("region", { name: "Sponsored" })).not.toContainText("House tibs");

        for (const other of [m2, m4]) {
            await page.goto(`/${other.businessId}/menu`);
            await expect(page.getByRole("heading", { name: "Mains" }).last()).toBeVisible();
            await expect(page.getByText("House tibs")).toHaveCount(0);
            await expect(page.getByText("B coffee")).toHaveCount(0);
            expect(await privacyText(page)).not.toContain(MODEL3_NOTICE);
        }

        // The Super Admin suspends A's ad with a reason
        await admin.getByRole("link", { name: "Restaurant ads" }).click();
        const adminTable = admin.getByRole("table", { name: "Restaurant ads" });
        await expect(adminTable).toContainText("House tibs");
        await admin.getByRole("button", { name: "Suspend House tibs" }).click();
        const suspend = admin.getByRole("dialog", { name: "Suspend ad" });
        await suspend.getByLabel("Reason (shown to the restaurant)").fill("Price not as shown");
        await suspend.getByRole("button", { name: "Suspend" }).click();
        await expect(adminTable).toContainText("Price not as shown");
        expect(await seriousViolations(admin)).toEqual([]);

        await page.goto(`/${a.businessId}/menu`);
        await expect(page.getByRole("heading", { name: "Mains" }).last()).toBeVisible();
        await expect(page.getByRole("region", { name: "Sponsored" })).toHaveCount(0);

        await owner.reload();
        await expect(table).toContainText("Suspended by Agafari");
        await expect(table).toContainText("Price not as shown");
        await expect(owner.getByRole("button", { name: "Resume House tibs" })).toHaveCount(0);
        await expect(owner.getByRole("button", { name: "Pause House tibs" })).toHaveCount(0);
        await owner.getByRole("button", { name: "Archive House tibs" }).click();
        await owner.getByRole("dialog", { name: "Archive ad" }).getByRole("button", { name: "Archive" }).click();
        await expect(table).toContainText("Archived");
    });
});
