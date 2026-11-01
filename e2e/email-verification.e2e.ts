import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

// AGF-S2-22 J17: email verification with the publish gate on (playwright.config.ts enables it for the suite's own
// demo backend). A new owner signs in as before and can build a menu, but publishing waits for verification; the link
// comes from the local demo outbox instead of an inbox.

const BACKEND = "http://127.0.0.1:8081";

test.describe("J17 email verification", () => {
    test("a new owner verifies their email through the link and can then publish", async ({ page, request }) => {
        const stamp = Date.now().toString(36);
        const email = `verify-${stamp}@e2e.agafari.test`;
        const password = `Aa1!${randomUUID()}`; // local, per-run test value

        // Register through the API (the wizard itself is covered by J11)
        const register = await request.post("/api/auth/register", { data: {
            fullName: "Verify Owner", email, password, businessName: `Verify Cafe ${stamp}`,
            businessPhone: `+2519${String(Date.now()).slice(-8)}`, customSubdomain: `verify-${stamp}`,
            open24_7: true, country: "ET", locationUrl: "https://maps.app.goo.gl/AbC123xyz",
        } });
        expect(register.status()).toBe(201);
        const token = (await register.json()).token as string;
        const auth = { Authorization: `Bearer ${token}` };

        // Sign-in is unchanged for an unverified owner
        await page.goto("/auth/login");
        await page.getByPlaceholder("you@example.com").fill(email);
        await page.getByPlaceholder("********").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page).toHaveURL(/\/admin/);
        await expect(page.getByRole("status").filter({ hasText: "Verify your email to publish menus." })).toBeVisible();

        // Drafts work; publishing is refused with a clear message
        const types = await (await request.get("/api/menus/type/all", { headers: auth })).json();
        const lunch = (types as { id: string; name: string }[]).find((t) => t.name.toLowerCase() === "lunch") ?? types[0];
        const created = await request.post("/api/menus", { headers: auth, data: { name: `Draft ${stamp}`, menuTypeId: lunch.id } });
        expect(created.status()).toBe(201);
        const menu = await created.json();
        const businessId = menu.businessId as string;
        await page.goto(`/${businessId}/admin/menus/${menu.id}`);
        await page.getByRole("button", { name: "Publish" }).click();
        await expect(page.getByRole("alert")).toHaveText("Verify your email to publish menus.");

        // The link from the demo outbox verifies the email
        const outbox = await request.get(`${BACKEND}/api/demo/email-verification-outbox`, { params: { email } });
        expect(outbox.status()).toBe(200);
        const link = (await outbox.json()).verifyUrl as string;
        expect(link).toContain("/auth/verify-email#token=");
        await page.goto(link);
        await expect(page.getByRole("heading", { name: "Email verified" })).toBeVisible();
        await expect(page).toHaveURL(/\/auth\/verify-email$/); // token removed from the address bar

        // Now publishing works and the banner is gone
        await page.goto(`/${businessId}/admin/menus/${menu.id}`);
        await expect(page.getByText("Verify your email to publish menus.")).toHaveCount(0);
        await page.getByRole("button", { name: "Publish" }).click();
        await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();
    });
});
