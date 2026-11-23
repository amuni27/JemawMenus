// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF EX-F (register §91, PO F-3): one exception, its facts and history, and the existing actions (claim, note, escalate,
// resolve, replay where allowed), each sending the row version back. An escalation target is typed by the Super Admin and
// never prefilled or assigned automatically. Nothing here moves money.

const exception = vi.fn(), exceptionHistory = vi.fn(), claimException = vi.fn(), addExceptionNote = vi.fn(), escalateException = vi.fn(),
    resolveException = vi.fn(), replayException = vi.fn();
vi.mock("../../api/adminApi", async (orig) => ({ ...(await orig<typeof import("../../api/adminApi")>()),
    adminApi: { exception, exceptionHistory, claimException, addExceptionNote, escalateException, resolveException, replayException } }));

const { default: SuperAdminExceptionDetail } = await import("./SuperAdminExceptionDetail.tsx");

const view = (over: Record<string, unknown> = {}) => ({ data: { id: "ex-1", businessId: null, code: "UNATTRIBUTED_PAYMENT", status: "OPEN", paymentId: null, checkoutId: null,
    providerEventId: "pe-1", refundRequestId: null, amountMinor: 2500, currency: "USD", paidAt: "2026-11-22T09:00:00Z", involvesCustomerFunds: true, ownerUserId: null,
    claimedAt: null, escalatedAt: null, escalationReason: null, escalatedTo: null, resolution: null, resolutionNote: null, resolvedBy: null, resolvedAt: null,
    createdAt: "2026-11-22T10:00:00Z", rowVersion: 4, dueAt: "2026-11-23T10:00:00Z", immediate: false, overdue: false, calendarIncomplete: false, sourceJobId: null, ...over } });
const history = [
    { id: "h2", occurredAt: "2026-11-22T11:00:00Z", actorLabel: "r***@admin.test", action: "BILLING_EXCEPTION_NOTE_ADDED", targetType: "BILLING_EXCEPTION", targetId: "ex-1",
        outcome: "SUCCESS", detail: "note: Looked in Stripe" },
    { id: "h1", occurredAt: "2026-11-22T10:00:00Z", actorLabel: "system", action: "BILLING_EXCEPTION_OPENED", targetType: "BILLING_EXCEPTION", targetId: "ex-1",
        outcome: "SUCCESS", detail: "code=UNATTRIBUTED_PAYMENT status=OPEN" },
];

function renderDetail() {
    return render(
        <MemoryRouter initialEntries={["/super-admin/exceptions/ex-1"]}>
            <Routes>
                <Route path="/super-admin/exceptions/:id" element={<SuperAdminExceptionDetail />} />
                <Route path="/super-admin/exceptions" element={<p>List page</p>} />
            </Routes>
        </MemoryRouter>,
    );
}

const actions = () => screen.getByRole("region", { name: "Actions" });

beforeEach(() => {
    for (const f of [exception, exceptionHistory, claimException, addExceptionNote, escalateException, resolveException, replayException]) f.mockReset();
    exception.mockResolvedValue(view());
    exceptionHistory.mockResolvedValue({ data: history });
    for (const f of [claimException, addExceptionNote, escalateException, resolveException]) f.mockResolvedValue(view({ rowVersion: 5 }));
    replayException.mockResolvedValue({ data: { exception: view({ rowVersion: 5 }).data, eventResult: "QUARANTINED" } });
});
afterEach(() => cleanup());

describe("Super Admin exception detail", () => {
    it("shows the facts of a platform exception and its history", async () => {
        renderDetail();
        expect(await screen.findByRole("heading", { level: 1, name: "Payment not matched to a restaurant" })).toBeTruthy();
        const facts = screen.getByRole("region", { name: "Facts" });
        expect(facts.textContent).toContain("No restaurant");
        expect(facts.textContent).toContain("$25.00");
        expect(facts.textContent).toContain("Open");
        expect(facts.textContent).toContain("pe-1");
        const items = within(screen.getByRole("region", { name: "History" })).getAllByRole("listitem");
        expect(items[0].textContent).toContain("Note added");
        expect(items[0].textContent).toContain("Looked in Stripe");
        expect(items[0].textContent).toContain("r***@admin.test");
        expect(items[1].textContent).toContain("Opened");
        expect(screen.getByRole("link", { name: "Back to exceptions" }).getAttribute("href")).toBe("/super-admin/exceptions");
    });

    it("offers only the actions the status allows", async () => {
        renderDetail();
        await screen.findByRole("heading", { level: 1 });
        const names = () => within(actions()).getAllByRole("button").map((b) => b.textContent);
        expect(names()).toEqual(["Claim", "Add note", "Escalate", "Resolve", "Replay"]);
        cleanup();
        exception.mockResolvedValue(view({ status: "ESCALATED", escalatedAt: "2026-11-22T12:00:00Z", escalationReason: "finance" }));
        renderDetail();
        await screen.findByRole("heading", { level: 1 });
        expect(names()).toEqual(["Add note", "Resolve", "Replay"]);
        cleanup();
        exception.mockResolvedValue(view({ providerEventId: null, sourceJobId: "job-1" })); // nothing to replay without a provider event
        renderDetail();
        await screen.findByRole("heading", { level: 1 });
        expect(names()).toEqual(["Claim", "Add note", "Escalate", "Resolve"]);
        cleanup();
        exception.mockResolvedValue(view({ status: "AUTO_HANDLING", providerEventId: null }));
        renderDetail();
        await screen.findByRole("heading", { level: 1 });
        expect(names()).toEqual(["Add note"]);
        cleanup();
        exception.mockResolvedValue(view({ status: "RESOLVED", resolution: "NO_ACTION_REQUIRED", resolvedBy: "a1", resolvedAt: "2026-11-22T13:00:00Z", resolutionNote: "dup" }));
        renderDetail();
        await screen.findByRole("heading", { level: 1 });
        expect(screen.queryByRole("region", { name: "Actions" })).toBeNull();
        expect(screen.getByRole("region", { name: "Facts" }).textContent).toContain("No action required");
    });

    it("claims with the row version and reloads", async () => {
        renderDetail();
        fireEvent.click(await within(await screen.findByRole("region", { name: "Actions" })).findByRole("button", { name: "Claim" }));
        await waitFor(() => expect(claimException).toHaveBeenCalledWith("ex-1", 4));
        await waitFor(() => expect(exception).toHaveBeenCalledTimes(2));
        expect(exceptionHistory).toHaveBeenCalledTimes(2);
    });

    it("adds a note only with text", async () => {
        renderDetail();
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(within(actions()).getByRole("button", { name: "Add note" }));
        const dialog = screen.getByRole("dialog", { name: "Add a note" });
        fireEvent.click(within(dialog).getByRole("button", { name: "Save note" }));
        expect((await within(dialog).findByRole("alert")).textContent).toBe("Write a note.");
        expect(addExceptionNote).not.toHaveBeenCalled();
        fireEvent.change(within(dialog).getByLabelText("Note"), { target: { value: "Asked the restaurant" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Save note" }));
        await waitFor(() => expect(addExceptionNote).toHaveBeenCalledWith("ex-1", 4, "Asked the restaurant"));
    });

    it("escalates with a reason; the target is typed, never prefilled, and may be left empty", async () => {
        renderDetail();
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(within(actions()).getByRole("button", { name: "Escalate" }));
        const dialog = screen.getByRole("dialog", { name: "Escalate this exception" });
        const target = within(dialog).getByLabelText("Escalate to (optional)") as HTMLInputElement;
        expect(target.value).toBe("");
        expect(dialog.textContent).toContain("Nothing is assigned automatically.");
        fireEvent.click(within(dialog).getByRole("button", { name: "Escalate" }));
        expect((await within(dialog).findByRole("alert")).textContent).toBe("Give a reason.");
        fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Needs finance" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Escalate" }));
        await waitFor(() => expect(escalateException).toHaveBeenCalledWith("ex-1", 4, "Needs finance", null));
        cleanup();
        escalateException.mockClear();
        renderDetail();
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(within(actions()).getByRole("button", { name: "Escalate" }));
        const again = screen.getByRole("dialog", { name: "Escalate this exception" });
        fireEvent.change(within(again).getByLabelText("Reason"), { target: { value: "Needs finance" } });
        fireEvent.change(within(again).getByLabelText("Escalate to (optional)"), { target: { value: "  Finance Operations  " } });
        fireEvent.click(within(again).getByRole("button", { name: "Escalate" }));
        await waitFor(() => expect(escalateException).toHaveBeenCalledWith("ex-1", 4, "Needs finance", "Finance Operations"));
    });

    it("resolves only with an outcome and a note", async () => {
        renderDetail();
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(within(actions()).getByRole("button", { name: "Resolve" }));
        const dialog = screen.getByRole("dialog", { name: "Resolve this exception" });
        expect(dialog.textContent).toContain("Resolving records what happened. It doesn't move money.");
        fireEvent.click(within(dialog).getByRole("button", { name: "Resolve" }));
        expect((await within(dialog).findByRole("alert")).textContent).toBe("Choose an outcome and write a note.");
        fireEvent.click(within(within(dialog).getByRole("group", { name: "Outcome" })).getByRole("radio", { name: "Funds handled outside Agafari" }));
        fireEvent.click(within(dialog).getByRole("button", { name: "Resolve" }));
        expect(resolveException).not.toHaveBeenCalled(); // an outcome alone isn't enough
        fireEvent.change(within(dialog).getByLabelText("Note"), { target: { value: "Refunded in Stripe" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Resolve" }));
        await waitFor(() => expect(resolveException).toHaveBeenCalledWith("ex-1", 4, "FUNDS_HANDLED_EXTERNALLY", "Refunded in Stripe"));
        expect(resolveException).toHaveBeenCalledTimes(1);
    });

    it("replays the provider event only after a confirmation and shows the result", async () => {
        renderDetail();
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(within(actions()).getByRole("button", { name: "Replay" }));
        const dialog = screen.getByRole("dialog", { name: "Replay the payment event?" });
        expect(dialog.textContent).toContain("Nothing is charged or refunded.");
        expect(replayException).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Replay" }));
        await waitFor(() => expect(replayException).toHaveBeenCalledWith("ex-1", 4));
        expect((await screen.findByRole("status")).textContent).toContain("Replay result: QUARANTINED");
    });

    it("shows the server's message when an action is refused, such as a newer version", async () => {
        claimException.mockRejectedValue({ response: { status: 409, data: { code: "BILLING_EXCEPTION_VERSION_CONFLICT",
            message: "The exception was changed by someone else. Reload to see the latest version." } } });
        renderDetail();
        await screen.findByRole("heading", { level: 1 });
        fireEvent.click(within(actions()).getByRole("button", { name: "Claim" }));
        expect((await screen.findByRole("alert")).textContent).toContain("changed by someone else");
    });

    it("says when the exception doesn't exist", async () => {
        exception.mockRejectedValue({ response: { status: 404 } });
        renderDetail();
        expect((await screen.findByRole("alert")).textContent).toContain("This exception wasn't found.");
    });
});
