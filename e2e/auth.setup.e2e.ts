import { test as setup } from "@playwright/test";
import { AUTH_FILE, expectOwnerArea, signIn } from "./support/owner";

// AGF-S2-28: sign in once through the UI and reuse the session in the owner journeys.
setup("owner signs in", async ({ page }) => {
    await signIn(page);
    await expectOwnerArea(page);
    await page.context().storageState({ path: AUTH_FILE });
});
