import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// AGF-S1-16 (after S1-16a): application code must not write to the browser console.
// Test files are excluded; ESLint `no-console` (warn) flags new calls during development.

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
    });
}

describe("browser console hygiene", () => {
    it("has no console calls in application source", () => {
        const root = join(process.cwd(), "src");
        const offenders = sourceFiles(root).flatMap((file) =>
            readFileSync(file, "utf8")
                .split("\n")
                .map((line, i) => ({ line: line.trim(), at: `${relative(root, file)}:${i + 1}` }))
                .filter(({ line }) => /\bconsole\.(log|info|debug|warn|error|trace)\s*\(/.test(line) && !line.startsWith("//"))
                .map(({ at, line }) => `${at}  ${line}`)
        );
        expect(offenders).toEqual([]);
    });
});
