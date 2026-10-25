import { describe, expect, it } from "vitest";
import { a5SheetHtml, escapeHtml, qrFileName, tableTentHtml } from "./printKit";

// AGF-S2-20: QR print kit layouts (A5 sheet, table tent) built in-app from the on-screen QR SVG, with every
// user-controlled value escaped, no external scripts, and safe download file names.

const QR = '<svg viewBox="0 0 21 21"><path d="M0 0h1v1H0z"/></svg>';
const input = {
    name: "Abol Café",
    logoUrl: "https://images.test.invalid/agafari/logos/b1/logo.png",
    url: "http://localhost:5175/b1/menu",
    qrSvg: QR,
};

describe("escapeHtml", () => {
    it("escapes markup and quotes", () => {
        expect(escapeHtml(`<b>Tom & "Jerry's"</b>`)).toBe("&lt;b&gt;Tom &amp; &quot;Jerry&#39;s&quot;&lt;/b&gt;");
    });
});

describe("A5 sheet", () => {
    // AC6
    it("is A5 portrait with logo, name, instruction, QR and address", () => {
        const html = a5SheetHtml(input);
        expect(html).toContain("size: A5 portrait");
        expect(html).toContain('src="https://images.test.invalid/agafari/logos/b1/logo.png"');
        expect(html).toContain("Abol Café");
        expect(html).toContain("Scan to see our menu");
        expect(html).toContain(QR);
        expect(html).toContain("http://localhost:5175/b1/menu");
        expect(html.match(/class="panel"/g)).toHaveLength(1);
    });

    // AC8
    it("prints without a logo when there is none, or drops a logo that fails to load", () => {
        const html = a5SheetHtml({ ...input, logoUrl: null });
        expect(html).not.toContain("<img");
        expect(html).toContain("Abol Café");
        expect(a5SheetHtml(input)).toMatch(/<img[^>]*onerror="this\.remove\(\)"/);
    });

    it("ignores a logo address that isn't http(s)", () => {
        expect(a5SheetHtml({ ...input, logoUrl: "javascript:alert(1)" })).not.toContain("<img");
    });
});

describe("table tent", () => {
    // AC7
    it("is A4 landscape with two identical panels, the top one upside down, and a fold line", () => {
        const html = tableTentHtml(input);
        expect(html).toContain("size: A4 landscape");
        expect(html.match(/class="panel/g)).toHaveLength(2);
        expect(html).toContain('class="panel flipped"');
        expect(html).toContain("rotate(180deg)");
        expect(html).toContain('class="fold"');
        expect(html.split("Scan to see our menu")).toHaveLength(3);
        expect(html.split(QR)).toHaveLength(3);
    });
});

describe("safety", () => {
    // AC9
    it("shows a hostile restaurant name and address as text, never markup", () => {
        const hostile = { ...input, name: `<b>Tom & "Jerry's"</b><script>alert(1)</script>`, url: `http://localhost:5175/"><x>/menu` };
        for (const html of [a5SheetHtml(hostile), tableTentHtml(hostile)]) {
            expect(html).not.toContain("<b>Tom");
            expect(html).not.toContain("<script>alert");
            expect(html).toContain("&lt;b&gt;Tom &amp; &quot;Jerry&#39;s&quot;&lt;/b&gt;");
            expect(html).not.toContain('"><x>');
        }
    });

    // AC9
    it("escapes the logo address inside the attribute", () => {
        const html = a5SheetHtml({ ...input, logoUrl: 'https://images.test.invalid/x.png" onload="alert(1)' });
        expect(html).not.toContain('" onload="alert(1)');
        expect(html).toContain("&quot; onload=&quot;alert(1)");
    });

    // AC9
    it("loads no external script", () => {
        for (const html of [a5SheetHtml(input), tableTentHtml(input)]) {
            expect(html).not.toMatch(/<script[^>]+src=/i);
        }
    });

    // AC9
    it("makes safe download file names", () => {
        expect(qrFileName("Abol Café", "png")).toBe("abol-caf-qr.png");
        expect(qrFileName('../../<evil> "name"', "svg")).toBe("evil-name-qr.svg");
        expect(qrFileName("", "png")).toBe("menu-qr.png");
        expect(qrFileName("ኣቦል", "svg")).toBe("menu-qr.svg");
        expect(qrFileName("x".repeat(200), "png")).toBe("x".repeat(60) + "-qr.png");
    });
});
