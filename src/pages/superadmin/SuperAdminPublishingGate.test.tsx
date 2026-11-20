// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// AGF FE-4 (register §56–§58): the Super Admin reviews the read-only publishing-gate dry run per market (BE-6) and signs off
// exactly the reviewed report (U-1: fingerprint re-checked before the dialog, and by the server). The page never enables
// anything: it only reads the report, downloads the CSV and posts the sign-off.

const publishGateSummary = vi.fn();
const publishGateSection = vi.fn();
const publishGateCsv = vi.fn();
const signOffPublishGate = vi.fn();
const otherMutations = { saveMonetizationConfig: vi.fn(), recordSubscription: vi.fn(), endSubscription: vi.fn(), startTrial: vi.fn() };
vi.mock("../../api/adminApi", async (orig) => ({
    ...(await orig<typeof import("../../api/adminApi")>()),
    adminApi: { publishGateSummary, publishGateSection, publishGateCsv, signOffPublishGate, ...otherMutations },
}));

const { default: SuperAdminPublishingGate } = await import("./SuperAdminPublishingGate.tsx");

const FP = "a".repeat(64);
const FP2 = "b".repeat(64);
const summary = (over: Record<string, unknown> = {}) => ({
    market: "ET", generatedAt: "2026-11-20T10:00:00Z", cutOver: "2026-12-01T00:00:00Z",
    config: { version: 3, setting: "SETTING_2", models: ["MODEL_2", "MODEL_4"] },
    ownerPlansVisible: true, trialsEnabled: true, selfServiceEnabled: true, periodEndEnabled: false, gateEnabled: false, billingEnabled: false,
    blockers: [], counts: { exempt: 3, allowed: 2, blocked: 3, errors: 0, total: 8, publishedWithoutPlan: 2, review: 1, notGated: 1 },
    fingerprint: FP, ...over,
});
const row = (name: string, extra: Record<string, unknown> = {}) => ({ businessId: `id-${name}`, name, country: "ET", createdAt: "2026-12-05T00:00:00Z", ...extra });
const page = (section: string, items: unknown[], total = items.length, p = 0) => ({ data: { section, items, page: p, size: 100, total } });

function Page() {
    return <MemoryRouter><SuperAdminPublishingGate /></MemoryRouter>;
}

beforeEach(() => {
    for (const fn of [publishGateSummary, publishGateSection, publishGateCsv, signOffPublishGate, ...Object.values(otherMutations)]) fn.mockReset();
    publishGateSummary.mockResolvedValue({ data: summary() });
    publishGateSection.mockImplementation((_m: string, section: string) => {
        if (section === "BLOCKED") return Promise.resolve(page(section, [row("Cafe One", { reason: "NO_PLAN", pendingRequest: true }), row("Cafe Two", { reason: "TRIAL_ENDED" }),
            row("Cafe Three", { reason: "SOMETHING_NEW" })]));
        if (section === "PUBLISHED_WITHOUT_PLAN") return Promise.resolve(page(section, [{ businessId: "id-x", name: "Old Cafe", menuId: "m1", menuName: "Lunch", restaurantSection: "EXEMPT" },
            { businessId: "id-y", name: "Cafe Two", menuId: "m2", menuName: "Dinner", restaurantSection: "BLOCKED" }]));
        if (section === "REVIEW") return Promise.resolve(page(section, [row("Old Cafe", { flags: ["OWNER_INACTIVE", "ENTITLED_ONLY_BECAUSE_PERIOD_END_OFF"] })]));
        return Promise.resolve(page(section, []));
    });
    signOffPublishGate.mockResolvedValue({ data: { market: "ET", signedAt: "2026-11-20T10:05:00Z", cutOver: "2026-12-01T00:00:00Z", fingerprint: FP } });
});
afterEach(() => cleanup());

const signOffButton = () => screen.getByRole("button", { name: /^Sign off ET/ });
const openSection = async (name: RegExp) => {
    fireEvent.click(screen.getByRole("button", { name }));
    return screen.findByRole("table", { name });
};
const openRequired = async () => {
    await openSection(/^Blocked/);
    await openSection(/^Published menus without a plan/);
    await openSection(/^Needs review/);
};

describe("publishing-gate dry run page", () => {
    it("shows the report's facts and counts, with the gate read-only", async () => {
        render(<Page />);
        const facts = await screen.findByRole("region", { name: "Report facts" });
        expect(facts.textContent).toContain("Publishing gate: Off");
        expect(facts.textContent).toContain("Setting 2");
        expect(facts.textContent).toContain("2026-12-01");
        expect(facts.textContent).toContain("Period-end processing: Off");
        const counts = screen.getByRole("region", { name: "Counts" });
        expect(within(counts).getByText("Exempt (existing)").parentElement?.textContent).toContain("3");
        expect(within(counts).getByText("Blocked (new, no plan)").parentElement?.textContent).toContain("3");
        expect(within(counts).getByText("Allowed (new, with a plan)").parentElement?.textContent).toContain("2");
        expect(screen.queryByRole("checkbox", { name: /gate/i })).toBeNull(); // nothing turns the gate on
        expect(publishGateSummary).toHaveBeenCalledWith("ET");
    });

    it("lists blockers in plain words and offers no sign-off", async () => {
        publishGateSummary.mockResolvedValue({ data: summary({ blockers: ["CUT_OVER_NOT_CONFIGURED", "OWNER_PLANS_HIDDEN"] }) });
        render(<Page />);
        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toContain("Cut-over date not configured");
        expect(alert.textContent).toContain("Owner plans are hidden");
        await openRequired(); // reviewed, but the blockers alone still prevent a sign-off
        expect((signOffButton() as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText("Resolve the blockers above before signing off.")).toBeTruthy();
    });

    it("shows warnings without opening sections", async () => {
        publishGateSummary.mockResolvedValue({ data: summary({ counts: { ...summary().counts, errors: 2 },
            latestSignOff: { signedAt: "2026-10-01T00:00:00Z", by: "root@admin.test", cutOver: "2026-11-01T00:00:00Z", fingerprint: FP2, valid: false } }) });
        render(<Page />);
        const warnings = await screen.findByRole("region", { name: "Warnings" });
        expect(warnings.textContent).toContain("2 restaurants couldn't be evaluated.");
        expect(warnings.textContent).toContain("1 restaurant needs review.");
        expect(warnings.textContent).toContain("Period-end processing is off");
        expect(warnings.textContent).toContain("The latest sign-off is no longer valid");
    });

    it("switches market and loads that market's report", async () => {
        render(<Page />);
        await screen.findByRole("region", { name: "Report facts" });
        publishGateSummary.mockResolvedValue({ data: summary({ market: "US" }) });
        fireEvent.click(screen.getByRole("radio", { name: "United States (US)" }));
        await waitFor(() => expect(publishGateSummary).toHaveBeenLastCalledWith("US"));
        expect(await screen.findByRole("button", { name: /^Sign off US/ })).toBeTruthy();
    });

    it("loads a section only when opened, in plain words, and pages through it", async () => {
        render(<Page />);
        await screen.findByRole("region", { name: "Counts" });
        expect(publishGateSection).not.toHaveBeenCalled();

        const blocked = await openSection(/^Blocked/);
        expect(publishGateSection).toHaveBeenCalledWith("ET", "BLOCKED", 0, 100);
        expect(blocked.textContent).toContain("No plan");
        expect(blocked.textContent).toContain("Pending plan request");
        expect(blocked.textContent).toContain("Trial ended");
        expect(blocked.textContent).toContain("SOMETHING_NEW"); // unknown codes verbatim

        const review = await openSection(/^Needs review/);
        expect(review.textContent).toContain("Owner inactive");
        expect(review.textContent).toContain("Allowed only because period-end is off");

        publishGateSection.mockResolvedValueOnce(page("EXEMPT", [row("A")], 150)).mockResolvedValueOnce(page("EXEMPT", [row("B")], 150, 1));
        await openSection(/^Exempt/);
        fireEvent.click(screen.getByRole("button", { name: "Next page" }));
        await waitFor(() => expect(publishGateSection).toHaveBeenLastCalledWith("ET", "EXEMPT", 1, 100));
        expect(await screen.findByText("Page 2 of 2")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /^Allowed/ })); // empty: a message, not a table
        expect(await screen.findByText("No restaurants in this section.")).toBeTruthy();
    });

    it("downloads the CSV through the admin session with the server's file name", async () => {
        const created = vi.fn(() => "blob:csv");
        const revoked = vi.fn();
        Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
        const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
        publishGateCsv.mockResolvedValue({ data: new Blob(["section\n"], { type: "text/csv" }), headers: { "content-disposition": 'attachment; filename="publish-gate-dry-run-ET.csv"' } });
        render(<Page />);
        fireEvent.click(await screen.findByRole("button", { name: "Download CSV (ET)" }));

        await waitFor(() => expect(clicked).toHaveBeenCalled());
        expect(publishGateCsv).toHaveBeenCalledWith("ET");
        const anchor = clicked.mock.contexts[0] as HTMLAnchorElement;
        expect(anchor.download).toBe("publish-gate-dry-run-ET.csv");
        expect(anchor.href).toBe("blob:csv");
        clicked.mockRestore();
    });

    it("requires the non-empty review sections to be opened before signing off", async () => {
        render(<Page />);
        await screen.findByRole("region", { name: "Counts" });
        expect((signOffButton() as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText("Open Blocked, Published menus without a plan and Needs review before signing off.")).toBeTruthy();
        await openRequired();
        expect((signOffButton() as HTMLButtonElement).disabled).toBe(false);
    });

    it("won't open the sign-off when the report changed since the review started", async () => {
        render(<Page />);
        await screen.findByRole("region", { name: "Counts" });
        await openRequired();
        publishGateSummary.mockResolvedValue({ data: summary({ fingerprint: FP2 }) });
        fireEvent.click(signOffButton());

        expect((await screen.findByRole("alert")).textContent).toContain("The report changed since you started reviewing. Refresh and review again.");
        expect(screen.queryByRole("dialog")).toBeNull();
        expect((signOffButton() as HTMLButtonElement).disabled).toBe(true); // the review starts again
        expect(signOffPublishGate).not.toHaveBeenCalled();
    });

    it("signs off the exact reviewed report after an explicit confirmation", async () => {
        render(<Page />);
        await screen.findByRole("region", { name: "Counts" });
        await openRequired();
        fireEvent.click(signOffButton());

        const dialog = await screen.findByRole("dialog", { name: "Sign off the ET dry run" });
        expect(dialog.textContent).toContain("It does not turn on publishing restrictions");
        expect(dialog.textContent).toContain("2026-12-01");
        expect(dialog.textContent).toContain("aaaaaaaaaaaa");
        expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));
        const confirm = within(dialog).getByRole("button", { name: "Sign off ET" }) as HTMLButtonElement;
        expect(confirm.disabled).toBe(true);
        fireEvent.click(within(dialog).getByRole("checkbox", { name: "I have reviewed this report for ET" }));
        expect(confirm.disabled).toBe(false);
        fireEvent.click(confirm);

        await waitFor(() => expect(signOffPublishGate).toHaveBeenCalledTimes(1));
        expect(signOffPublishGate).toHaveBeenCalledWith("ET", FP);
        const done = await screen.findByRole("status", { name: "Sign-off result" });
        expect(done.textContent).toContain("Signed off");
        expect(done.textContent).toContain("Valid until");
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("Escape cancels the dialog and returns focus to the trigger", async () => {
        render(<Page />);
        await screen.findByRole("region", { name: "Counts" });
        await openRequired();
        fireEvent.click(signOffButton());
        await screen.findByRole("dialog");
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("dialog")).toBeNull();
        await waitFor(() => expect(document.activeElement).toBe(signOffButton()));
        expect(signOffPublishGate).not.toHaveBeenCalled();
    });

    it.each([
        ["the report changed", { response: { status: 409, data: { code: "DRY_RUN_CHANGED", message: "x" } } }, "The report changed just now. Refresh and review again."],
        ["blockers appeared", { response: { status: 409, data: { code: "DRY_RUN_BLOCKED", message: "The dry run has blockers: OWNER_PLANS_HIDDEN" } } }, "The dry run has blockers: OWNER_PLANS_HIDDEN"],
        ["the session ended", { response: { status: 401, data: {} } }, "Your admin session ended. Sign in again."],
        ["no permission", { response: { status: 403, data: {} } }, "Your account can't sign off."],
        ["the network failed", { code: "ERR_NETWORK", message: "Network Error" }, "Couldn't reach the server; nothing was signed."],
    ])("explains a refused sign-off when %s and never retries", async (_label, err, text) => {
        signOffPublishGate.mockRejectedValue(err);
        render(<Page />);
        await screen.findByRole("region", { name: "Counts" });
        await openRequired();
        fireEvent.click(signOffButton());
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("checkbox"));
        fireEvent.click(within(dialog).getByRole("button", { name: "Sign off ET" }));

        expect((await screen.findByRole("alert")).textContent).toContain(text);
        expect(signOffPublishGate).toHaveBeenCalledTimes(1);
    });

    it("only reads the report and posts the sign-off: nothing else changes", async () => {
        render(<Page />);
        await screen.findByRole("region", { name: "Counts" });
        await openRequired();
        fireEvent.click(screen.getByRole("button", { name: "Refresh report" }));
        await waitFor(() => expect(publishGateSummary).toHaveBeenCalledTimes(2));
        fireEvent.click(signOffButton());
        for (const fn of Object.values(otherMutations)) expect(fn).not.toHaveBeenCalled();
    });
});
