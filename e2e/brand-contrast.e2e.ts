import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE, BUSINESS_ID } from "./support/owner";

// AGF D-8 J30 (register §61, option A): white-text brand buttons meet WCAG AA contrast: the Menus page "Create Menu" and the
// shared primary Button (the same component as the FE-3 unpublish dialog's "Unpublish"), at desktop and phone widths.

async function contrast(page: Page, include: string): Promise<string[]> {
    const result = await new AxeBuilder({ page }).withRules(["color-contrast"]).include(include).analyze();
    return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

test.describe("J30 brand button contrast", () => {
    test.use({ storageState: AUTH_FILE });

    for (const width of [1280, 375]) {
        test(`Create Menu and the primary button pass color-contrast at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
            await page.goto(`/${BUSINESS_ID}/admin/menus`);
            const create = page.getByRole("link", { name: /Create Menu/ }).or(page.getByRole("button", { name: /Create Menu/ })).first();
            await expect(create).toBeVisible();
            expect(await contrast(page, "main")).toEqual([]);

            await page.goto(`/${BUSINESS_ID}/admin/menus/new`);
            const save = page.getByRole("button", { name: "Save Menu" });
            await expect(save).toBeVisible();
            await expect(save).toHaveCSS("background-color", "rgb(225, 29, 72)"); // brand-dark #E11D48
            expect(await contrast(page, "main")).toEqual([]);
        });
    }
});
