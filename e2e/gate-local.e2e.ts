import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";

// AGF gate-local (register §56 D-6): BE-4 + BE-6 + FE-2/3/4 together against a LOCAL disposable-PostgreSQL environment where
// publish-requires-plan is on for ET, enabled the legitimate way (cut-over configured, owner plans visible, a signed ET dry
// run, PostgreSQL; FlagMatrix unchanged). Opt-in only: it runs when E2E_GATE_BASE_URL points at that environment and is never
// part of the default suite (playwright.config.ts). No production data or credentials; no stubbing.

const BACKEND = process.env.E2E_GATE_BACKEND_URL ?? "";
const PLAN_MESSAGE = "Choose a plan to publish your menu. You can keep editing it meanwhile.";

type Owner = { email: string; password: string; token: string; businessId: string };

function need(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is not set (the gate-local runner sets it)`);
    return v;
}

async function api(request: APIRequestContext, method: string, path: string, data?: unknown, token?: string) {
    const res = await request.fetch(`${BACKEND}/api${path}`, { method, data, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const text = await res.text();
    return { status: res.status(), body: text ? JSON.parse(text) : null };
}

async function adminToken(request: APIRequestContext): Promise<string> {
    const r = await api(request, "POST", "/admin/auth/login", { email: need("E2E_GATE_ADMIN_EMAIL"), password: need("E2E_GATE_ADMIN_PASSWORD") });
    expect(r.status).toBe(200);
    return r.body.token;
}

async function configure(request: APIRequestContext, setting: "SETTING_1" | "SETTING_2") {
    const admin = await adminToken(request);
    const current = (await api(request, "GET", "/admin/monetization-config", undefined, admin)).body;
    if (current?.setting === setting) return current.version as number;
    const models = setting === "SETTING_1" ? ["MODEL_1"] : ["MODEL_2", "MODEL_4"];
    const saved = await api(request, "PUT", "/admin/monetization-config", { setting, models, expectedVersion: current?.version ?? 0 }, admin);
    expect(saved.status).toBe(200);
    return saved.body.version as number;
}

async function register(request: APIRequestContext, label: string): Promise<Owner> {
    const tag = randomBytes(3).toString("hex");
    const email = `gate-${label}-${tag}@owner.local`, password = `Aa1!${randomUUID()}`; // local, per-run test values
    const r = await api(request, "POST", "/auth/register", { fullName: "Gate Owner", email, password, businessName: `Gate ${label} ${tag}`,
        businessPhone: `+2519${String(Date.now()).slice(-8)}`, customSubdomain: `gate-${label}-${tag}`, open24_7: true, country: "ET",
        locationUrl: "https://maps.app.goo.gl/AbC123xyz" });
    expect(r.status).toBe(201);
    const me = await api(request, "GET", "/auth/me", undefined, r.body.token);
    return { email, password, token: r.body.token, businessId: me.body.business.id };
}

/** A draft menu with one item (guests only see menus with content). */
async function draftMenu(request: APIRequestContext, owner: { token: string }, name: string): Promise<string> {
    const types = (await api(request, "GET", "/menus/type/all", undefined, owner.token)).body as { id: string }[];
    const menu = await api(request, "POST", "/menus", { name, menuTypeId: types[0].id, isActive: false }, owner.token);
    expect(menu.status).toBe(201);
    const category = await api(request, "POST", `/menus/${menu.body.id}/categories`, { name: "Mains" }, owner.token);
    expect((await api(request, "POST", `/menus/${menu.body.id}/items`, { categoryId: category.body.id, name: `${name} dish`, price: 250, ingredients: ["teff"] }, owner.token)).status).toBe(201);
    return menu.body.id;
}

async function signIn(page: Page, owner: { email: string; password: string }) {
    await page.goto("/auth/login");
    await page.getByPlaceholder("you@example.com").fill(owner.email);
    await page.getByPlaceholder("********").fill(owner.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin/);
}

async function seriousViolations(page: Page, include: string): Promise<string[]> {
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).include(include).analyze();
    return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

async function axeAtBothWidths(page: Page, include: string) {
    for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        // soft: a violation fails the run but the journey continues, so every later step is still exercised
        expect.soft(await seriousViolations(page, include), `${include} at ${width}px`).toEqual([]);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
}

async function guestSees(page: Page, businessId: string, text: string) {
    await page.goto(`/${businessId}/menu`);
    await expect(page.getByText(text).first()).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("gate-local: publishing gate on (ET)", () => {
    test.beforeAll(async ({ request }) => {
        const admin = await adminToken(request);
        const s = (await api(request, "GET", "/admin/publish-gate/dry-run?market=ET", undefined, admin)).body;
        expect(s.gateEnabled, "the environment must run with the ET gate on").toBe(true);
        expect(s.blockers).toEqual([]);
        expect(s.latestSignOff?.valid).toBe(true);
        await configure(request, "SETTING_2");
    });

    test("a new restaurant without a plan keeps drafts, is refused publishing and is pointed to a plan", async ({ page, request }) => {
        const owner = await register(request, "noplan");
        const menuId = await draftMenu(request, owner, "Noplan Lunch"); // drafts are allowed
        const refused = await api(request, "PATCH", `/menus/${menuId}`, { isActive: true }, owner.token);
        expect(refused.status).toBe(409);
        expect(refused.body.code).toBe("PLAN_REQUIRED_TO_PUBLISH");

        await page.setViewportSize({ width: 1280, height: 900 });
        await signIn(page, owner);
        await page.goto(`/${owner.businessId}/admin/menus/${menuId}`);
        await expect(page.getByText("Publishing needs a plan.", { exact: false })).toBeVisible(); // publishAllowed false (BE-5b)
        await page.getByRole("button", { name: "Publish", exact: true }).click();
        const notice = page.getByRole("region", { name: "Publishing refused" });
        await expect(notice.getByRole("alert")).toHaveText(PLAN_MESSAGE);
        await expect(page.getByText("Unpublished").first()).toBeVisible();
        await axeAtBothWidths(page, '[aria-label="Publishing refused"]');

        // keyboard: from Publish, back to the notice's link, Enter opens Subscription & Plans
        const link = notice.getByRole("link", { name: "Choose a plan" });
        await page.getByRole("button", { name: "Publish", exact: true }).focus();
        for (let i = 0; i < 15 && !(await link.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Shift+Tab");
        await expect(link).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(new RegExp(`/${owner.businessId}/admin/plans$`));

        await page.goto(`/${owner.businessId}/menu`);
        await expect(page.getByText("Noplan Lunch dish")).toHaveCount(0); // guests never see the refused menu
    });

    test("Save as draft instead keeps everything typed and saves it unpublished", async ({ page, request }) => {
        const owner = await register(request, "draft");
        await signIn(page, owner);
        await page.goto(`/${owner.businessId}/admin/menus/new`);
        await page.getByRole("option", { name: /.+/ }).first().waitFor({ state: "attached" });
        const name = page.getByRole("textbox").first(); // the Menu Name field (its label isn't programmatically associated)
        await name.fill("Typed Dinner");
        const type = page.getByLabel("Menu Type");
        await type.selectOption({ index: 1 });
        await page.getByRole("checkbox", { name: /Published/ }).check();
        await expect(page.getByText("Publishing needs a plan; you can save this menu as a draft.")).toBeVisible();
        await page.getByRole("button", { name: "Save Menu" }).click();

        const notice = page.getByRole("region", { name: "Publishing refused" });
        await expect(notice.getByRole("alert")).toHaveText(PLAN_MESSAGE);
        await expect(name).toHaveValue("Typed Dinner");
        await expect(page.getByRole("checkbox", { name: /Published/ })).toBeChecked();
        await axeAtBothWidths(page, '[aria-label="Publishing refused"]');
        await notice.getByRole("button", { name: "Save as draft instead" }).click();
        await expect(page).toHaveURL(new RegExp(`/${owner.businessId}/admin/menus$`));
        const saved = (await api(request, "GET", "/menus", undefined, owner.token)).body as { name: string; active: boolean }[];
        expect(saved.find((m) => m.name === "Typed Dinner")?.active).toBe(false);
    });

    test("an active subscription allows publishing and guests see the menu", async ({ page, request }) => {
        const version = await configure(request, "SETTING_2");
        const owner = await register(request, "subscribed");
        const admin = await adminToken(request);
        expect((await api(request, "POST", `/admin/businesses/${owner.businessId}/subscription`, { planCode: "MODEL_2", expectedConfigVersion: version }, admin)).status).toBe(201);
        const menuId = await draftMenu(request, owner, "Paid Lunch");

        await signIn(page, owner);
        await page.goto(`/${owner.businessId}/admin/menus/${menuId}`);
        await expect(page.getByText("Publishing needs a plan.", { exact: false })).toHaveCount(0);
        await page.getByRole("button", { name: "Publish", exact: true }).click();
        await expect(page.getByRole("button", { name: "Unpublish", exact: true })).toBeVisible();
        await guestSees(page, owner.businessId, "Paid Lunch dish");
    });

    test("an existing restaurant (before the cut-over) is exempt", async ({ page, request }) => {
        const existing = { email: need("E2E_GATE_EXISTING_EMAIL"), password: need("E2E_GATE_EXISTING_PASSWORD"), businessId: need("E2E_GATE_EXISTING_BUSINESS_ID") };
        const login = await api(request, "POST", "/auth/login", { email: existing.email, password: existing.password });
        expect(login.status).toBe(200);
        const menuId = await draftMenu(request, { token: login.body.token }, `Exempt Specials ${randomBytes(2).toString("hex")}`);

        await signIn(page, existing);
        await page.goto(`/${existing.businessId}/admin/menus/${menuId}`);
        await expect(page.getByText("Publishing needs a plan.", { exact: false })).toHaveCount(0);
        await page.getByRole("button", { name: "Publish", exact: true }).click();
        await expect(page.getByRole("button", { name: "Unpublish", exact: true })).toBeVisible();
        await guestSees(page, existing.businessId, "Shiro"); // the menu published before the gate stays visible
    });

    test("email verification can't be checked here: it isn't operational without an email provider", async ({ request }) => {
        const owner = await register(request, "verify");
        const me = (await api(request, "GET", "/auth/me", undefined, owner.token)).body;
        expect(me.user?.emailVerification?.available ?? me.emailVerification?.available).toBe(false); // covered by PublishGateTest and J17 instead
    });

    test("a trial allows publishing; once it expires, new publishing is refused, published menus stay, and unpublishing warns", async ({ page, request }) => {
        const version = await configure(request, "SETTING_1");
        const owner = await register(request, "trial");
        const admin = await adminToken(request);
        expect((await api(request, "POST", `/admin/businesses/${owner.businessId}/trial`, { expectedConfigVersion: version }, admin)).status).toBe(201);
        const live = await draftMenu(request, owner, "Trial Breakfast");
        const later = await draftMenu(request, owner, "Trial Supper");

        await signIn(page, owner);
        await page.goto(`/${owner.businessId}/admin/menus/${live}`);
        await page.getByRole("button", { name: "Publish", exact: true }).click();
        await expect(page.getByRole("button", { name: "Unpublish", exact: true })).toBeVisible();

        // the trial ends (admin action; the same state as an expired trial)
        const view = (await api(request, "GET", `/admin/businesses/${owner.businessId}/subscription`, undefined, admin)).body;
        expect((await api(request, "PATCH", `/admin/businesses/${owner.businessId}/subscription`, { status: "EXPIRED", rowVersion: view.current.rowVersion }, admin)).status).toBe(200);

        await guestSees(page, owner.businessId, "Trial Breakfast dish"); // policy 7: still published
        const refused = await api(request, "PATCH", `/menus/${later}`, { isActive: true }, owner.token);
        expect(refused.status).toBe(409);

        await page.goto(`/${owner.businessId}/admin/menus/${live}`);
        await page.getByRole("button", { name: "Unpublish", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Unpublish this menu?" });
        await expect(dialog).toContainText("you can't publish it again until you choose a plan");
        await expect(dialog.getByRole("button", { name: "Keep it published" })).toBeFocused();
        await axeAtBothWidths(page, '[role="dialog"]');
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Unpublish", exact: true })).toBeVisible(); // kept

        await page.getByRole("button", { name: "Unpublish", exact: true }).click();
        await dialog.getByRole("button", { name: "Unpublish", exact: true }).click();
        await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Publish", exact: true }).click(); // B-6: a new publish
        await expect(page.getByRole("region", { name: "Publishing refused" }).getByRole("alert")).toHaveText(PLAN_MESSAGE);

        await page.goto(`/${owner.businessId}/menu`);
        await expect(page.getByText("Trial Breakfast dish")).toHaveCount(0);
        await configure(request, "SETTING_2");
    });
});
