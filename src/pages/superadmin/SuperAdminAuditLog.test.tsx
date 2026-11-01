// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// AGF E4-M1 (AC10, AC11): the audit log page lists events newest first in an accessible table, with paging.

const auditEvents = vi.fn();
vi.mock("../../api/adminApi", async (orig) => ({ ...(await orig<typeof import("../../api/adminApi")>()), adminApi: { auditEvents } }));

const { default: SuperAdminAuditLog } = await import("./SuperAdminAuditLog.tsx");

const event = (id: string, action: string, outcome: string) =>
    ({ id, occurredAt: "2026-11-01T10:00:00Z", actorLabel: "r***@admin.test", action, outcome, detail: null, targetType: null, targetId: null });

beforeEach(() => {
    auditEvents.mockReset();
    auditEvents.mockResolvedValue({ data: { items: [], page: 0, size: 25, total: 0 } });
});
afterEach(() => cleanup());

describe("Super Admin audit log", () => {
    it("shows the events in a table with column headers", async () => {
        auditEvents.mockResolvedValue({ data: { items: [event("e2", "ADMIN_LOGIN_SUCCEEDED", "SUCCESS"), event("e1", "ADMIN_LOGIN_FAILED", "FAILURE")], page: 0, size: 25, total: 2 } });
        render(<SuperAdminAuditLog />);
        const table = await screen.findByRole("table", { name: "Audit log" });
        expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Time", "Actor", "Action", "Outcome", "Detail"]);
        const rows = within(table).getAllByRole("row").slice(1);
        expect(rows[0].textContent).toContain("ADMIN_LOGIN_SUCCEEDED");
        expect(rows[1].textContent).toContain("FAILURE");
        expect(auditEvents).toHaveBeenCalledWith(0, 25);
    });

    it("keeps the scrollable table reachable by keyboard on narrow screens", async () => {
        auditEvents.mockResolvedValue({ data: { items: [event("e1", "ADMIN_LOGIN_FAILED", "FAILURE")], page: 0, size: 25, total: 1 } });
        render(<SuperAdminAuditLog />);
        const region = await screen.findByRole("region", { name: "Audit log table (scrolls sideways)" });
        expect(region.getAttribute("tabindex")).toBe("0");
        expect(within(region).getByRole("table", { name: "Audit log" })).toBeTruthy();
    });

    it("pages through older events", async () => {
        auditEvents.mockResolvedValue({ data: { items: [event("e1", "ADMIN_LOGIN_FAILED", "FAILURE")], page: 0, size: 25, total: 30 } });
        render(<SuperAdminAuditLog />);
        fireEvent.click(await screen.findByRole("button", { name: "Older" }));
        expect(auditEvents).toHaveBeenLastCalledWith(1, 25);
    });

    it("says when there are no events yet", async () => {
        auditEvents.mockResolvedValue({ data: { items: [], page: 0, size: 25, total: 0 } });
        render(<SuperAdminAuditLog />);
        expect(await screen.findByText("No audit events yet.")).toBeTruthy();
    });
});
