import { expect, test } from "@playwright/test";
import { BUSINESS_ID, RESTAURANT, guestMenuPath } from "./support/owner";

// AGF-S2-21 J10: link previews. Chat apps fetch pages without running JavaScript, so the checks read the raw HTML the
// way a crawler does, and a browser check confirms people opening the share link land on the guest menu.

const CRAWLER = { "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" };
const meta = (html: string, attr: "name" | "property", key: string) =>
    html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1];

test.describe("J10 share previews", () => {
    test("the restaurant share page carries its own preview tags and points at the guest menu", async ({ request, baseURL }) => {
        const res = await request.get(`/venue/${BUSINESS_ID}/share`, { headers: CRAWLER });
        expect(res.status()).toBe(200);
        expect(res.headers()["content-type"]).toContain("text/html");
        expect(res.headers()["cache-control"]).toContain("max-age=300");

        const html = await res.text();
        expect(meta(html, "property", "og:title")).toBe(RESTAURANT);
        expect(meta(html, "property", "og:description")).toBe(`See ${RESTAURANT}&#39;s menu, Addis Ababa on Agafari.`);
        expect(meta(html, "property", "og:url")).toBe(`${baseURL}${guestMenuPath}`);
        expect(meta(html, "name", "twitter:card")).toBe("summary");
        expect(html).not.toContain("<script");
    });

    test("people opening the share link land on the guest menu", async ({ page, baseURL }) => {
        await page.goto(`/venue/${BUSINESS_ID}/share`);
        await expect(page).toHaveURL(`${baseURL}${guestMenuPath}`);
        await expect(page.getByText(RESTAURANT).first()).toBeVisible();
    });

    test("an unknown restaurant gets a 404 page without a redirect", async ({ request }) => {
        const res = await request.get("/venue/not-a-real-business/share", { headers: CRAWLER });
        expect(res.status()).toBe(404);
        const html = await res.text();
        expect(meta(html, "property", "og:title")).toBe("Agafari");
        expect(html).not.toContain('http-equiv="refresh"');
    });

    test("every guest page has the generic site preview tags", async ({ request }) => {
        const html = await (await request.get(guestMenuPath, { headers: CRAWLER })).text();
        expect(meta(html, "property", "og:site_name")).toBe("Agafari");
        expect(meta(html, "property", "og:title")).toBe("Agafari");
        expect(meta(html, "name", "description")).toBe("Browse restaurant menus on Agafari.");
    });
});
