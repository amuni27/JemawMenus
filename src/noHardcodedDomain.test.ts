/// <reference types="node" />
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// AGF-S2-20 / D2: the future domain is provisional (the product may be renamed), so no proposed brand domain may be
// hard-coded in application source, the HTML shell or tracked env files. The guest menu base URL is configuration.

const FORBIDDEN = /agafari\.com|agafarimenu\.com/i;

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        return /\.(ts|tsx|css|html)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
    });
}

describe("no hard-coded brand domain (D2)", () => {
    it("appears nowhere in application source or index.html", () => {
        const root = process.cwd();
        const files = [...sourceFiles(join(root, "src")), join(root, "index.html")];
        const offenders = files.filter((f) => FORBIDDEN.test(readFileSync(f, "utf8"))).map((f) => relative(root, f));
        expect(offenders).toEqual([]);
    });

    it("appears in no tracked env file", () => {
        // a file deleted in the working tree but not yet staged is still listed; it can't contain anything
        const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n")
            .filter((f) => /(^|\/)\.env/.test(f) && existsSync(join(process.cwd(), f)));
        const offenders = tracked.filter((f) => FORBIDDEN.test(readFileSync(join(process.cwd(), f), "utf8")));
        expect(offenders).toEqual([]);
    });

    it("documents the configuration in .env.example without a real domain", () => {
        const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
        expect(example).toMatch(/^VITE_PUBLIC_MENU_BASE_URL=http:\/\/localhost:\d+$/m);
        expect(example).toMatch(/^VITE_API_BASE_URL=http:\/\/localhost:\d+$/m);
        expect(example).toMatch(/rebuild/i);
    });
});
