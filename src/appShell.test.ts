/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// AGF-S2-29: proper tab title; placeholder pricing/deals pages and unused plan/ad/deal types are gone.

const root = process.cwd();

describe("app shell and removed placeholders", () => {
    it("titles every page Agafari", () => {
        expect(readFileSync(join(root, "index.html"), "utf8")).toMatch(/<title>Agafari<\/title>/);
    });

    it("has no pricing page, deals stub, duplicate QR page or unused plan/ad/deal types", () => {
        for (const file of ["src/pages/public/Pricing.tsx", "src/pages/admin/DealsPage.tsx", "src/pages/admin/QrPage.tsx",
            "src/types/index.ts", "src/types/dashboard.ts"]) {
            expect(existsSync(join(root, file)), file).toBe(false);
        }
    });
});
