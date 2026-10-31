/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// AGF-S2-28 (AC4, D-S2-28-2): the smoke suite talks to the real backend; API responses are never stubbed.

describe("E2E smoke suite", () => {
    it("never stubs network calls", () => {
        const dir = join(process.cwd(), "e2e");
        const files = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((f) => /\.e2e\.ts$/.test(f));
        expect(files.length).toBeGreaterThan(0);
        const offenders = files.filter((f) => /\.route\(|routeFromHAR|\.fulfill\(/.test(readFileSync(join(dir, f), "utf8")));
        expect(offenders).toEqual([]);
    });
});
