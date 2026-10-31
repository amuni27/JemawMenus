/// <reference types="node" />
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// AGF-S2-21 approach C: every page's HTML carries generic, brand-level preview tags (chat apps don't run JavaScript).
// No domain is written into them (D2); restaurant-specific previews come from the backend share page (approach A).

const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
const meta = (attr: "name" | "property", key: string) =>
    html.match(new RegExp(`<meta\\s+${attr}="${key.replace(":", "\\:")}"\\s+content="([^"]*)"`))?.[1];

describe("site-level share tags (index.html)", () => {
    it("has a description and generic Open Graph and Twitter tags", () => {
        expect(meta("name", "description")).toBe("Browse restaurant menus on Agafari.");
        expect(meta("property", "og:site_name")).toBe("Agafari");
        expect(meta("property", "og:type")).toBe("website");
        expect(meta("property", "og:title")).toBe("Agafari");
        expect(meta("property", "og:description")).toBe("Browse restaurant menus on Agafari.");
        expect(meta("name", "twitter:card")).toBe("summary");
    });

    it("writes no address into the tags (no og:url, no og:image, no domain)", () => {
        expect(meta("property", "og:url")).toBeUndefined();
        expect(meta("property", "og:image")).toBeUndefined();
        const tags = html.match(/<meta[^>]+(og:|twitter:|name="description")[^>]*>/g) ?? [];
        expect(tags.length).toBeGreaterThanOrEqual(6);
        expect(tags.join("\n")).not.toMatch(/https?:\/\//);
    });
});
