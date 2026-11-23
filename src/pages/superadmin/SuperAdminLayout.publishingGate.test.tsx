// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF FE-4 (U-3): the console's navigation links to the Publishing gate dry run.

const me = vi.fn().mockResolvedValue({ data: { id: "a1", email: "root@admin.test", role: "ADMIN" } });
vi.mock("../../api/adminApi", async (orig) => ({ ...(await orig<typeof import("../../api/adminApi")>()), adminApi: { me, exceptionSummary: () => Promise.resolve({ data: { unresolved: 0, open: 0, escalated: 0, autoHandling: 0, overdue: 0 } }) } }));

const { default: SuperAdminLayout } = await import("./SuperAdminLayout.tsx");
const { ADMIN_TOKEN_KEY } = await import("../../api/adminApi");

afterEach(() => { cleanup(); localStorage.clear(); });

describe("Super Admin navigation", () => {
    it("links to the Publishing gate page", async () => {
        localStorage.setItem(ADMIN_TOKEN_KEY, "admin-token");
        render(
            <MemoryRouter initialEntries={["/super-admin"]}>
                <Routes>
                    <Route path="/super-admin" element={<SuperAdminLayout />}>
                        <Route index element={<p>Overview page</p>} />
                        <Route path="publishing-gate" element={<p>Publishing gate page</p>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );
        const nav = await screen.findByRole("navigation", { name: "Super Admin" });
        fireEvent.click(screen.getByRole("link", { name: "Publishing gate" }));
        expect(await screen.findByText("Publishing gate page")).toBeTruthy();
        expect(nav).toBeTruthy();
    });
});
