// AGF-S2-28: run environment for the E2E smoke suite (plain ESM so CI can call it with `node` directly).
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";

export const BACKEND_REPO = "https://github.com/amuni27/jemaw-menu-backend-spring";

/** URL-safe random secret: never logged, generated per run (D-S2-28-6). */
/** @param {number} [length] */
export function randomSecret(length = 32) {
    return randomBytes(length * 2).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, length);
}

/**
 * Backend branch for this frontend run (D-S2-28-5): pull requests test against the backend branch with the PR's
 * base name (normally `develop`); pushes use the backend branch with the same name when it exists; otherwise `develop`.
 * @param {{ event?: string, headRef?: string, baseRef?: string, refName?: string, exists: (branch: string) => boolean }} ctx
 */
export function pickBackendRef({ event, baseRef, refName, exists }) {
    if (event === "pull_request" && baseRef && exists(baseRef)) return baseRef;
    if (event !== "pull_request" && refName && exists(refName)) return refName;
    return "develop";
}

/** @param {string} branch */
function backendBranchExists(branch) {
    const out = execFileSync("git", ["ls-remote", "--heads", BACKEND_REPO, `refs/heads/${branch}`], { encoding: "utf8" });
    return out.trim().length > 0;
}

// CI: `node e2e/support/runEnv.mjs backend-ref` prints the backend branch to check out.
if (process.argv[2] === "backend-ref") {
    process.stdout.write(pickBackendRef({
        event: process.env.GITHUB_EVENT_NAME,
        baseRef: process.env.GITHUB_BASE_REF,
        refName: process.env.GITHUB_REF_NAME,
        exists: backendBranchExists,
    }));
}
