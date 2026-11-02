// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// ONB Phase 1 (UX-AC6): Account & Settings no longer holds plan controls; it links to Subscription & Plans while plans are
// visible, and shows nothing about plans otherwise.

vi.mock("../../app/context/AuthContext", () => ({
    useAuth: () => ({ user: { id: "u1", fullName: "Demo Owner", email: "owner@example.com", role: "VENUE" },
        business: { id: "biz-1", name: "Abol Cafe", currency: "ETB", customSubdomain: "abol" }, refresh: vi.fn() }),
}));
const get = vi.hoisted(() => vi.fn());
vi.mock("../../api/planApi", () => ({ default: { get } }));

const { default: AccountPage } = await import("./AccountPage.tsx");

afterEach(() => { cleanup(); get.mockReset(); });

const renderPage = () => render(<ToastProvider><MemoryRouter><AccountPage /></MemoryRouter></ToastProvider>);

describe("account page plan link", () => {
    it("links to Subscription & Plans without any plan controls", async () => {
        get.mockResolvedValue({ data: { visible: true, setting: "SETTING_2", plans: [{ code: "MODEL_2", model: "MODEL_2", adSource: "AGAFARI", paid: false }], canRequest: true } });
        renderPage();
        const link = await screen.findByRole("link", { name: "Subscription & Plans" });
        expect(link.getAttribute("href")).toBe("/biz-1/admin/plans");
        expect(screen.queryByRole("button", { name: /^Request / })).toBeNull();
        expect(document.getElementById("plan")).toBeNull();
    });

    it("shows nothing about plans while they aren't visible", async () => {
        get.mockResolvedValue({ data: { visible: false } });
        renderPage();
        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(screen.queryByRole("link", { name: "Subscription & Plans" })).toBeNull();
    });
});
