// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF FE-R2 (assessment story 7; backend R5-03-D; N2 in register §69): the owner's notice list on Subscription & Plans:
// delivered renewal notices, newest first, written from their data (dates in the restaurant's time zone), with "Mark as read".

const get = vi.fn();
const notices = vi.fn();
const readNotice = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get, notices, readNotice, request: vi.fn(), withdraw: vi.fn(), activate: vi.fn(), startTrial: vi.fn(), openCardUpdate: vi.fn() } }));
const auth = { value: { user: { email: "owner@cafe.test", emailVerification: { verified: true, available: true, publishGateEnabled: false } }, refresh: vi.fn() } };
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => auth.value }));

const { default: SubscriptionPlansPage } = await import("./SubscriptionPlansPage.tsx");

function PlansPage() {
    return (
        <MemoryRouter initialEntries={["/biz-1/admin/plans"]}>
            <Routes>
                <Route path="/:tenantSlug/admin/plans" element={<SubscriptionPlansPage />} />
            </Routes>
        </MemoryRouter>
    );
}

const ZONE = "Africa/Addis_Ababa";
const day = (iso: string) => new Intl.DateTimeFormat(undefined, { timeZone: ZONE, year: "numeric", month: "numeric", day: "numeric" }).format(new Date(Date.parse(iso) - 1));
const notice = (id: string, kind: string, data: Record<string, unknown>, read = false) => ({ id, kind, read, createdAt: "2026-12-21T06:00:00Z", data: { timeZone: ZONE, ...data } });

beforeEach(() => {
    for (const fn of [get, notices, readNotice]) fn.mockReset();
    get.mockResolvedValue({ data: { visible: true, setting: "SETTING_2", configVersion: 3, plans: [], canRequest: false, featuresUnaffected: true } });
});
afterEach(() => cleanup());

describe("owner notice list", () => {
    it("writes each renewal notice from its data, with dates in the restaurant's time zone", async () => {
        notices.mockResolvedValue({ data: [
            notice("n1", "RENEWAL_PAYMENT_REQUEST", { planCode: "MODEL_4", graceUntil: "2026-12-27T22:30:00Z", day: 0 }),
            notice("n2", "RENEWAL_PAYMENT_REQUEST", { planCode: "MODEL_4", graceUntil: "2026-12-27T22:30:00Z", day: 6 }),
            notice("n3", "PAYMENT_RECEIVED", { planCode: "MODEL_4", periodEnd: "2027-01-20T22:30:00Z", amountMinor: 2500, currency: "USD" }, true),
            notice("n4", "EXPIRY_NOTICE", { planCode: "MODEL_4", endedAt: "2026-12-27T22:30:00Z" }, true),
            notice("n5", "PLAN_ENDED_REFUND", { planCode: "MODEL_4", endedAt: "2026-12-27T22:30:00Z", amountMinor: 2500, currency: "USD" }, true),
            notice("n6", "SOMETHING_NEW", {}, true),
        ] });
        render(<PlansPage />);
        const list = await screen.findByRole("list", { name: "Notices" });
        const items = within(list).getAllByRole("listitem");
        expect(items).toHaveLength(6);
        expect(items[0].textContent).toContain(`Update your card by ${day("2026-12-27T22:30:00Z")}`);
        expect(items[0].textContent).not.toContain("reminder");
        expect(items[1].textContent).toContain("Last reminder");
        expect(items[2].textContent).toContain("Payment received");
        expect(items[2].textContent).toContain("$25.00");
        expect(items[2].textContent).toContain(day("2027-01-20T22:30:00Z"));
        expect(items[3].textContent).toContain(`ended on ${day("2026-12-27T22:30:00Z")}`);
        expect(items[4].textContent).toContain("will be refunded");
        expect(items[5].textContent).toContain("You have a new notice");
    });

    it("marks an unread notice as read and shows it as read", async () => {
        notices.mockResolvedValueOnce({ data: [notice("n1", "EXPIRY_NOTICE", { endedAt: "2026-12-27T22:30:00Z" })] })
            .mockResolvedValueOnce({ data: [notice("n1", "EXPIRY_NOTICE", { endedAt: "2026-12-27T22:30:00Z" }, true)] });
        readNotice.mockResolvedValue({ status: 204 });
        render(<PlansPage />);
        const item = within(await screen.findByRole("list", { name: "Notices" })).getByRole("listitem");
        expect(item.textContent).toContain("New");
        fireEvent.click(within(item).getByRole("button", { name: "Mark as read" }));
        await waitFor(() => expect(readNotice).toHaveBeenCalledWith("n1"));
        await waitFor(() => expect(within(screen.getByRole("list", { name: "Notices" })).queryByRole("button", { name: "Mark as read" })).toBeNull());
        expect(within(screen.getByRole("list", { name: "Notices" })).getByRole("listitem").textContent).not.toContain("New");
    });

    it("says so when marking as read fails, and keeps the notice unread", async () => {
        notices.mockResolvedValue({ data: [notice("n1", "EXPIRY_NOTICE", { endedAt: "2026-12-27T22:30:00Z" })] });
        readNotice.mockRejectedValue({ response: { status: 404 } });
        render(<PlansPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Mark as read" }));
        expect((await screen.findByRole("alert")).textContent).toContain("Couldn't mark the notice as read");
        expect(screen.getByRole("button", { name: "Mark as read" })).toBeTruthy();
    });

    it("shows an empty state when there are no notices", async () => {
        notices.mockResolvedValue({ data: [] });
        render(<PlansPage />);
        const section = await screen.findByRole("region", { name: "Notices" });
        expect(await within(section).findByText("No notices yet.")).toBeTruthy();
    });

    it("leaves the rest of the page working when notices can't be loaded", async () => {
        notices.mockRejectedValue({ response: { status: 500 } });
        render(<PlansPage />);
        await screen.findByRole("region", { name: "Subscription & Plans" });
        await waitFor(() => expect(notices).toHaveBeenCalled());
        expect(screen.queryByRole("region", { name: "Notices" })).toBeNull();
    });

    it("never renders notice data as markup", async () => {
        notices.mockResolvedValue({ data: [notice("n1", "PAYMENT_RECEIVED", { planCode: "<img src=x onerror=alert(1)>", periodEnd: "2027-01-20T22:30:00Z", amountMinor: 1, currency: "USD" })] });
        const { container } = render(<PlansPage />);
        await screen.findByRole("list", { name: "Notices" });
        expect(container.querySelector("img")).toBeNull();
    });
});
