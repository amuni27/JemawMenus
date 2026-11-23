// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF EX-F (register §91): the Super Admin's list of billing exceptions. Unresolved by default, deadline first; a platform
// exception shows "No restaurant"; overdue is marked in words; the summary keeps open, escalated, automatic and overdue apart.

const exceptions = vi.fn(), exceptionSummary = vi.fn();
vi.mock("../../api/adminApi", async (orig) => ({ ...(await orig<typeof import("../../api/adminApi")>()), adminApi: { exceptions, exceptionSummary } }));

const { default: SuperAdminExceptions } = await import("./SuperAdminExceptions.tsx");

const item = (over: Record<string, unknown> = {}) => ({ id: "ex-1", code: "UNATTRIBUTED_PAYMENT", status: "OPEN", businessId: null, businessName: null, amountMinor: 2500,
    currency: "USD", involvesCustomerFunds: true, createdAt: "2026-11-22T10:00:00Z", dueAt: "2026-11-23T10:00:00Z", overdue: false, claimedBy: null, escalatedTo: null,
    providerEventId: "pe-1", sourceJobId: null, ...over });
const page = (items: unknown[], over: Record<string, unknown> = {}) => ({ data: { items, page: 0, size: 20, total: items.length, ...over } });

function renderList() {
    return render(
        <MemoryRouter initialEntries={["/super-admin/exceptions"]}>
            <Routes>
                <Route path="/super-admin/exceptions" element={<SuperAdminExceptions />} />
                <Route path="/super-admin/exceptions/:id" element={<p>Detail page</p>} />
            </Routes>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    exceptions.mockReset();
    exceptionSummary.mockReset();
    exceptionSummary.mockResolvedValue({ data: { unresolved: 3, open: 1, escalated: 1, autoHandling: 1, overdue: 1 } });
    exceptions.mockResolvedValue(page([
        item(),
        item({ id: "ex-2", code: "STATE_CHANGED", status: "ESCALATED", businessId: "biz-1", businessName: "Cafe One", amountMinor: 250000, currency: "ETB", overdue: false,
            escalatedTo: "Finance Operations" }),
        item({ id: "ex-3", code: "PAYMENT_OUTCOME_PENDING_REVIEW", status: "IN_REVIEW", overdue: true, claimedBy: "r***@admin.test", amountMinor: null, currency: null,
            providerEventId: null, sourceJobId: "job-1" }),
    ]));
});
afterEach(() => cleanup());

describe("Super Admin exceptions list", () => {
    it("lists unresolved exceptions with their restaurant or none, amount, status, deadline and who has them", async () => {
        renderList();
        const table = await screen.findByRole("table", { name: "Exceptions" });
        expect(exceptions).toHaveBeenCalledWith("UNRESOLVED", 0, 20);
        expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Exception", "Restaurant", "Amount", "Status", "Due", "Claimed by", "Details"]);
        const [, r1, r2, r3] = within(table).getAllByRole("row");
        expect(r1.textContent).toContain("Payment not matched to a restaurant");
        expect(r1.textContent).toContain("No restaurant");
        expect(r1.textContent).toContain("$25.00");
        expect(r1.textContent).toContain("Open");
        expect(r2.textContent).toContain("Cafe One");
        expect(r2.textContent).toMatch(/ETB\s?2,500\.00/);
        expect(r2.textContent).toContain("Escalated");
        expect(r3.textContent).toContain("Payment outcome unresolved");
        expect(r3.textContent).toContain("In review");
        expect(r3.textContent).toContain("Overdue");
        expect(r3.textContent).toContain("r***@admin.test");
        expect(within(r1).getByRole("link", { name: "Open exception: Payment not matched to a restaurant" }).getAttribute("href")).toBe("/super-admin/exceptions/ex-1");
    });

    it("shows the summary with each count kept apart", async () => {
        renderList();
        const summary = await screen.findByRole("list", { name: "Exception counts" });
        expect(within(summary).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Unresolved 3", "Open 1", "Escalated 1", "Automatic handling 1", "Overdue 1"]);
    });

    it("filters by state and pages", async () => {
        exceptions.mockResolvedValue(page([item()], { total: 45 }));
        renderList();
        await screen.findByRole("table", { name: "Exceptions" });
        fireEvent.change(screen.getByLabelText("Show"), { target: { value: "ALL" } });
        await waitFor(() => expect(exceptions).toHaveBeenLastCalledWith("ALL", 0, 20));
        expect(screen.getByText("Page 1 of 3")).toBeTruthy();
        expect((screen.getByRole("button", { name: "Previous page" }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "Next page" }));
        await waitFor(() => expect(exceptions).toHaveBeenLastCalledWith("ALL", 1, 20));
    });

    it("says when there's nothing to review", async () => {
        exceptions.mockResolvedValue(page([]));
        exceptionSummary.mockResolvedValue({ data: { unresolved: 0, open: 0, escalated: 0, autoHandling: 0, overdue: 0 } });
        renderList();
        expect(await screen.findByText("No exceptions to review.")).toBeTruthy();
        expect(screen.queryByRole("table")).toBeNull();
    });

    it("reports a failed load", async () => {
        exceptions.mockRejectedValue({ response: { status: 500 } });
        renderList();
        expect((await screen.findByRole("alert")).textContent).toContain("Couldn't load the exceptions.");
    });
});
