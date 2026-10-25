import { describe, expect, it } from "vitest";
import { pickBackendRef, randomSecret } from "./runEnv.mjs";

// AGF-S2-28: the harness helpers that choose the backend branch (D-S2-28-5) and the per-run secrets (D-S2-28-6).

const branches = new Set(["develop", "main", "feature/AGF-S2-18-duplicate-menu"]);
const exists = (b: string) => branches.has(b);

describe("pickBackendRef", () => {
    it("pushes use the same-named backend branch when it exists", () => {
        expect(pickBackendRef({ event: "push", refName: "feature/AGF-S2-18-duplicate-menu", exists })).toBe("feature/AGF-S2-18-duplicate-menu");
    });

    it("pushes of frontend-only branches fall back to develop", () => {
        expect(pickBackendRef({ event: "push", refName: "feature/AGF-S2-20-qr-print-kit", exists })).toBe("develop");
    });

    it("pull requests test against the backend branch named like the PR base", () => {
        expect(pickBackendRef({ event: "pull_request", baseRef: "develop", refName: "2/merge", exists })).toBe("develop");
        expect(pickBackendRef({ event: "pull_request", baseRef: "release-x", refName: "2/merge", exists })).toBe("develop");
    });

    it("manual runs without a matching branch use develop", () => {
        expect(pickBackendRef({ event: "workflow_dispatch", refName: "nope", exists })).toBe("develop");
    });
});

describe("randomSecret", () => {
    it("is long, URL-safe and different every time", () => {
        const a = randomSecret(32);
        const b = randomSecret(32);
        expect(a).toMatch(/^[A-Za-z0-9]{32}$/);
        expect(a).not.toBe(b);
        expect(randomSecret(12)).toHaveLength(12);
    });
});
