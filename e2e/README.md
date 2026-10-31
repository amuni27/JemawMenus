# E2E smoke suite (AGF-S2-28)

Thirteen owner → guest journeys in Chromium against the **real backend in its demo profile** (in-memory data, seeded
restaurant "Abol Demo Café" and owner `owner@demo.agafari.test`). It complements the unit and integration tests; it
does not replace real-device or screen-reader checks (S2-27) or production verification.

| Journey | What it protects |
|---|---|
| J1 | Owner sign-in (wrong password stays on login) and sign-out |
| J2 | Create a menu (starts Unpublished), a category and an item |
| J3 | Unpublished menus stay hidden from guests; the owner preview shows them |
| J4 | Published menus reach guests: listed, searchable, item detail |
| J5 | Sold out is shown to guests; "Mark all available" brings items back |
| J6 | Unpublishing hides the menu again; old item links show the friendly not-found |
| J7 | The QR page shows the configured guest address, and it opens the guest menu |
| J8 | Signed-out admin pages go to login; unknown pages and restaurants show friendly screens |
| J9 | Guest accessibility: axe scan at 375 / 1280 px, waiter dialog focus, keyboard, reflow and zoom (S2-27) |
| J10 | Share previews: crawler tags, redirect to the guest menu, 404 for unknown restaurants (S2-21) |
| J11 | Location by country (S2-12 + CR1): Ethiopian link → "Get Directions", replace but not remove; registration at 375 px (Ethiopia link only, switch to US fields) and desktop (US address, add/remove link); S2-26: US time zone pre-selected from the state, guest "open now" in New York time (fixed clock, winter and summer) |
| J12 | Account page on phones (AGF-S2-35, Defect F2): no sideways scroll at 375/320 px (phone emulation), Edit buttons and Copy link on-screen, profile editor inside the screen; desktop keeps two columns |
| J13 | Bilingual menu (AGF-S2-23): owner adds a dish with an Amharic name; guest at 375 px switches to አማርኛ (field-by-field fallback), choice kept after reload, Amharic search, dish detail in Amharic |

## Run locally

Prerequisites: Node 22+, JDK 21, and the backend repository checked out next to this one
(`../jemaw-menu-backend-spring`), or set `E2E_BACKEND_DIR` to its path. Install the browser once:

```bash
npx playwright install chromium
```

```bash
npm run e2e
```

The suite builds the frontend in `e2e` mode and serves it on **5176**, starts the backend on **8081**, runs the
journeys and stops both. It never uses the demo ports (5175 / 8080). The preview server forwards `/api` and `/venue`
to the backend, so the browser stays same-origin and the backend needs no CORS change.

- Secrets (owner password, JWT and reset secrets) are **random per run** and only passed through the environment.
- Optional: `E2E_BROWSER_CHANNEL=chrome` uses an installed Chrome instead of the downloaded Chromium.
- After a failure: `npm run e2e:report` opens the HTML report (screenshots of failed steps). No traces or videos are
  recorded, because they would capture typed values.

## In CI

The `E2E smoke (Playwright)` job in Frontend CI checks out the backend at the **same-named branch** if it exists,
otherwise `develop` (pull requests use the base branch's name). The log prints the branch and commit under test.
One retry is allowed in CI; a retried test is marked in the report. On failure the report and screenshots are
uploaded as the `e2e-report` artifact (kept 7 days).

## Adding a journey

- Keep it a smoke path: few steps, high value. Edge cases belong in unit or integration tests.
- Use roles, labels and visible text, as the unit tests do. Never stub network calls (a unit test enforces this).
- Owner steps use `test.use({ storageState: AUTH_FILE })`; guest steps use `guestPage(browser)` (signed out).
- Give anything you create a `uniqueName(...)`, so runs never depend on each other.
