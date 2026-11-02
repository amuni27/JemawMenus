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
// AGF E4-M1: the first Super Admin for J18, random per run (never committed)
process.env.E2E_ADMIN_EMAIL ||= `root-${randomSecret(8).toLowerCase().replace(/[^a-z0-9]/g, "x")}@admin.agafari.test`;
process.env.E2E_ADMIN_PASSWORD ||= `Aa1!${randomSecret(24)}`;

const BACKEND_PORT = 8081;
const FRONTEND = "http://127.0.0.1:5176";
// AGF E4-M7: J24 runs against its own demo backend and frontend with entitlements and Agafari ads on, so J1–J23 keep their
// flags (J20 checks that monetization stays inactive). AGF E4-M8: J25 (restaurant ads) runs there too, after J24, with
// restaurant ads also on. Local in-memory demo only.
const ADS_BACKEND_PORT = 8082;
const ADS_FRONTEND = "http://127.0.0.1:5177";
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
            testIgnore: [/auth\.setup\.e2e\.ts$/, /(^|\/)(restaurant-)?ads\.e2e\.ts$/],
            dependencies: ["setup"],
            use: { ...devices["Desktop Chrome"], channel: process.env.E2E_BROWSER_CHANNEL || undefined },
        },
        {
            name: "ads",
            testMatch: /(^|\/)(restaurant-)?ads\.e2e\.ts$/, // J24, then J25
            use: { ...devices["Desktop Chrome"], channel: process.env.E2E_BROWSER_CHANNEL || undefined, baseURL: ADS_FRONTEND },
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
                // AGF E4-M1: bootstrap the first Super Admin (the demo profile authorizes it; values random per run)
                APP_ADMIN_BOOTSTRAP_EMAIL: process.env.E2E_ADMIN_EMAIL,
                APP_ADMIN_BOOTSTRAP_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
                APP_MONETIZATION_OWNER_PLANS_VISIBLE: "true", // AGF E4-M4: on for the local in-memory E2E demo (J21 needs it, J1–J17 prove no regression); default false everywhere else
                APP_MONETIZATION_TRIALS_ENABLED: "true", // AGF E4-M5: on for the local in-memory E2E demo (J22 needs it); default false everywhere else
                APP_MONETIZATION_TRANSITIONS_ENABLED: "true", // AGF E4-M6: on for the local in-memory E2E demo (J23 needs it); default false everywhere else
                APP_MONETIZATION_TRIAL_EXPIRY_CRON: "*/5 * * * * *", // AGF E4-M6: the daily job every 5 s in the demo, so J23 sees an end within seconds
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
        {
            // AGF E4-M7: started once the first backend answers (it has compiled), so the two Maven runs never compile at once
            name: "backend for J24 (demo profile, ads on)",
            cwd: backendDir,
            command: `until curl -sf -o /dev/null http://127.0.0.1:${BACKEND_PORT}/venue/00000000-0000-4000-8000-0000000000b1/menu; do sleep 2; done; mkdir -p target/e2e-run-ads && sh ./mvnw -q -B -Pdemo spring-boot:run -Dspring-boot.run.profiles=demo "-Dspring-boot.run.arguments=--server.port=${ADS_BACKEND_PORT}" -Dspring-boot.run.workingDirectory=target/e2e-run-ads`,
            url: `http://127.0.0.1:${ADS_BACKEND_PORT}/venue/00000000-0000-4000-8000-0000000000b1/menu`,
            timeout: 400_000,
            reuseExistingServer: !CI,
            stdout: "ignore",
            stderr: "pipe",
            env: {
                APP_JWT_SECRET: process.env.E2E_JWT_SECRET,
                APP_PASSWORD_RESET_SECRET: process.env.E2E_RESET_SECRET,
                APP_EMAIL_VERIFICATION_SECRET: process.env.E2E_VERIFY_SECRET,
                APP_ADMIN_BOOTSTRAP_EMAIL: process.env.E2E_ADMIN_EMAIL,
                APP_ADMIN_BOOTSTRAP_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
                APP_MONETIZATION_ENTITLEMENTS_ENABLED: "true", // AGF E4-M7: on only in this J24 demo backend
                APP_MONETIZATION_AGAFARI_ADS_ENABLED: "true", // AGF E4-M7: on only in this J24 demo backend; default false everywhere else
                APP_MONETIZATION_RESTAURANT_ADS_ENABLED: "true", // AGF E4-M8: on only in this demo backend (J25); default false everywhere else
                DEMO_OWNER_PASSWORD: process.env.E2E_OWNER_PASSWORD,
                APP_PUBLIC_MENU_BASE_URL: ADS_FRONTEND,
            },
        },
        {
            name: "frontend for J24 (production build)",
            command: "npx vite build --mode e2e --outDir dist-e2e-ads && npx vite preview --mode e2e --outDir dist-e2e-ads --host 127.0.0.1 --port 5177 --strictPort",
            url: ADS_FRONTEND,
            timeout: 180_000,
            reuseExistingServer: !CI,
            stdout: "ignore",
            stderr: "pipe",
            env: {
                VITE_API_BASE_URL: ADS_FRONTEND,
                VITE_PUBLIC_MENU_BASE_URL: ADS_FRONTEND,
                E2E_BACKEND_URL: `http://127.0.0.1:${ADS_BACKEND_PORT}`,
            },
        },
    ],
});
