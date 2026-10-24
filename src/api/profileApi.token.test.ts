// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

// AGF-S1-11 / PO-6: when PATCH /api/user returns a new token (email changed), it replaces the stored one.

const updateRequest = vi.fn();
vi.mock("../services/apiService", () => ({ updateRequest }));
vi.mock("../services/apiAuth", () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const { profileApi } = await import("./profileApi.ts");

describe("profileApi.updateUser token reissue", () => {
    afterEach(() => localStorage.clear());

    it("stores the token returned when the email changes", async () => {
        localStorage.setItem("token", "old-token");
        localStorage.setItem("session", JSON.stringify({ token: "old-token", user: { email: "old@example.com" } }));
        updateRequest.mockResolvedValue({ data: { id: "u1", email: "new@example.com", token: "new-token" } });

        await profileApi.updateUser({ email: "new@example.com", currentPassword: "secret" });

        expect(updateRequest).toHaveBeenCalledWith("/user", { email: "new@example.com", currentPassword: "secret" });
        expect(localStorage.getItem("token")).toBe("new-token");
        expect(JSON.parse(localStorage.getItem("session")!).token).toBe("new-token");
    });

    it("keeps the stored token when no new one is returned", async () => {
        localStorage.setItem("token", "old-token");
        updateRequest.mockResolvedValue({ data: { id: "u1", fullName: "Renamed" } });

        await profileApi.updateUser({ fullName: "Renamed" });

        expect(localStorage.getItem("token")).toBe("old-token");
    });
});
