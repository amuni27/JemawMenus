// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF-S2-22: the email-verification banner is part of the owner area.

vi.mock("../../app/context/AuthContext", () => ({
    useAuth: () => ({
        user: { fullName: "Demo Owner", email: "owner@example.com", emailVerification: { verified: false, available: true, publishGateEnabled: true } },
        business: { id: "own-biz", name: "Cafe" }, logout: vi.fn(), refresh: vi.fn(),
    }),
}));
vi.mock("../../api/emailVerificationApi", () => ({ emailVerificationApi: { resend: vi.fn() } }));

const { default: AdminLayout } = await import("./AdminLayout.tsx");

afterEach(() => cleanup());

describe("AdminLayout email verification", () => {
    it("shows the banner above the owner's page", () => {
        render(
            <MemoryRouter initialEntries={["/own-biz/admin/menus"]}>
                <Routes>
                    <Route path="/:tenantSlug/admin" element={<AdminLayout />}>
                        <Route path="menus" element={<p>Owner menus page</p>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );
        expect(screen.getByText("Verify your email to publish menus.", { exact: false })).toBeTruthy();
        expect(screen.getByText("Owner menus page")).toBeTruthy();
    });
});
