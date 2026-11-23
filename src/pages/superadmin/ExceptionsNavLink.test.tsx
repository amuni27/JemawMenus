// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// AGF EX-F (register §91, PO F-2): the console's Exceptions link shows how many exceptions are unresolved: each record once
// (never open + overdue added together), refreshed every 60 s while the console is open. No badge at zero or on failure.

const exceptionSummary = vi.fn();
vi.mock("../../api/adminApi", async (orig) => ({ ...(await orig<typeof import("../../api/adminApi")>()), adminApi: { exceptionSummary } }));

const { default: ExceptionsNavLink } = await import("./ExceptionsNavLink.tsx");

const summary = (unresolved: number, over: Record<string, number> = {}) => ({ data: { unresolved, open: unresolved, escalated: 0, autoHandling: 0, overdue: 0, ...over } });
const renderLink = () => render(<MemoryRouter><ExceptionsNavLink className={() => ""} /></MemoryRouter>);
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
    exceptionSummary.mockReset();
    vi.useFakeTimers();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe("Exceptions nav link", () => {
    it("shows the distinct unresolved count, not open plus overdue", async () => {
        exceptionSummary.mockResolvedValue(summary(3, { open: 2, escalated: 1, overdue: 2 }));
        renderLink();
        await flush();
        const link = screen.getByRole("link", { name: "Exceptions, 3 unresolved" });
        expect(link.getAttribute("href")).toBe("/super-admin/exceptions");
        expect(link.textContent).toContain("3");
        expect(link.textContent).not.toContain("5");
    });

    it("shows no badge at zero or when the count can't be read", async () => {
        exceptionSummary.mockResolvedValue(summary(0));
        renderLink();
        await flush();
        expect(screen.getByRole("link", { name: "Exceptions" }).textContent).toBe("Exceptions");
        cleanup();
        exceptionSummary.mockRejectedValue(new Error("offline"));
        renderLink();
        await flush();
        expect(screen.getByRole("link", { name: "Exceptions" }).textContent).toBe("Exceptions");
    });

    it("refreshes every 60 seconds and stops when it leaves the page", async () => {
        exceptionSummary.mockResolvedValueOnce(summary(1)).mockResolvedValue(summary(2));
        const { unmount } = renderLink();
        await flush();
        expect(screen.getByRole("link", { name: "Exceptions, 1 unresolved" })).toBeTruthy();
        await flush(59_000);
        expect(exceptionSummary).toHaveBeenCalledTimes(1);
        await flush(1_000);
        expect(exceptionSummary).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("link", { name: "Exceptions, 2 unresolved" })).toBeTruthy();
        unmount();
        await flush(180_000);
        expect(exceptionSummary).toHaveBeenCalledTimes(2);
    });
});
