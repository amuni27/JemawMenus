import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import { randomSecret } from "./e2e/support/runEnv.mjs";

// AGF-S2-28: owner → guest smoke suite against the real backend in its demo profile (in-memory data, seeded owner).
// The suite starts its own backend (8081) and production-build frontend (5176), never the PO demo (8080 / 5175).
// Secrets are random per run and travel only through the environment (workers inherit it, so they stay the same).

process.env.E2E_OWNER_PASSWORD ||= randomSecret(24);
process.env.E2E_JWT_SECRET ||= randomSecret(64);
process.env.E2E_RESET_SECRET ||= randomSecret(64);
process.env.E2E_VERIFY_SECRET ||= randomSecret(64); // AGF-S2-22

const BACKEND_PORT = 8081;
const FRONTEND = "http://127.0.0.1:5176";
const backendDir = resolve(process.env.E2E_BACKEND_DIR ?? "../jemaw-menu-backend-spring");
const CI = !!process.env.CI;

export default defineConfig({
    testDir: "./e2e",
    testMatch: /.*\.e2e\.ts$/,
    fullyParallel: false,
    workers: 1, // one shared in-memory backend; journeys are independent but run one after another
    forbidOnly: CI,
    retries: CI ? 1 : 0,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    reporter: CI ? [["list"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
    use: {
        baseURL: FRONTEND,
        // No traces or videos: they would record typed values such as the owner password (D-S2-28-8)
        trace: "off",
        video: "off",
        screenshot: "only-on-failure",
    },
    projects: [
        { name: "setup", testMatch: /auth\.setup\.e2e\.ts$/ },
        {
            name: "smoke",
            testIgnore: /auth\.setup\.e2e\.ts$/,
            dependencies: ["setup"],
            use: { ...devices["Desktop Chrome"], channel: process.env.E2E_BROWSER_CHANNEL || undefined },
        },
    ],
    webServer: [
        {
            name: "backend (demo profile)",
            cwd: backendDir,
            // Run from an empty working directory so a developer's application-local.yml is never imported
            command: `mkdir -p target/e2e-run && sh ./mvnw -q -B -Pdemo spring-boot:run -Dspring-boot.run.profiles=demo "-Dspring-boot.run.arguments=--server.port=${BACKEND_PORT}" -Dspring-boot.run.workingDirectory=target/e2e-run`,
            url: `http://127.0.0.1:${BACKEND_PORT}/venue/00000000-0000-4000-8000-0000000000b1/menu`,
            timeout: 300_000,
            reuseExistingServer: !CI,
            stdout: "ignore",
            stderr: "pipe",
            env: {
                APP_JWT_SECRET: process.env.E2E_JWT_SECRET,
                APP_PASSWORD_RESET_SECRET: process.env.E2E_RESET_SECRET,
                // AGF-S2-22: verification works through the demo outbox, and the publish gate is on for J17
                APP_EMAIL_VERIFICATION_SECRET: process.env.E2E_VERIFY_SECRET,
                APP_EMAIL_VERIFICATION_LINK_BASE_URL: `${FRONTEND}/auth/verify-email`,
                APP_EMAIL_VERIFICATION_ENFORCE: "true",
                DEMO_OWNER_PASSWORD: process.env.E2E_OWNER_PASSWORD,
                // AGF-S2-21: share pages redirect to the frontend under test
                APP_PUBLIC_MENU_BASE_URL: FRONTEND,
            },
        },
        {
            name: "frontend (production build)",
            command: "npx vite build --mode e2e --outDir dist-e2e && npx vite preview --mode e2e --outDir dist-e2e --host 127.0.0.1 --port 5176 --strictPort",
            url: FRONTEND,
            timeout: 180_000,
            reuseExistingServer: !CI,
            stdout: "ignore",
            stderr: "pipe",
            env: {
                // Same-origin: the preview server proxies /api and /venue to the backend (vite.config.ts, e2e mode)
                VITE_API_BASE_URL: FRONTEND,
                VITE_PUBLIC_MENU_BASE_URL: FRONTEND,
                E2E_BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}`,
            },
        },
    ],
});
