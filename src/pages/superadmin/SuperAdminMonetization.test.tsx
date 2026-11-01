// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// AGF E4-M2 (AC11): the Super Admin chooses Setting 1 (Model 1 only) or Setting 2 (at least one of Models 2-4), confirms
// old -> new before saving, sees a conflict message when someone else saved first, and sees the version history.

const monetizationConfig = vi.fn();
const saveMonetizationConfig = vi.fn();
const monetizationHistory = vi.fn();
vi.mock("../../api/adminApi", async (orig) => ({
    ...(await orig<typeof import("../../api/adminApi")>()),
    adminApi: { monetizationConfig, saveMonetizationConfig, monetizationHistory },
}));

const { default: SuperAdminMonetization } = await import("./SuperAdminMonetization.tsx");

const config = (version: number, setting: string, models: string[]) => ({
    configured: true, version, setting, models, effectiveFrom: "2026-11-01T10:00:00Z", changedAt: "2026-11-01T10:00:00Z",
    changedBy: "r***@admin.test",
});
const emptyHistory = { data: { items: [], page: 0, size: 20, total: 0 } };

beforeEach(() => {
    monetizationConfig.mockReset();
    saveMonetizationConfig.mockReset();
    monetizationHistory.mockReset();
    monetizationConfig.mockResolvedValue({ data: { configured: false } });
    saveMonetizationConfig.mockResolvedValue({ data: config(1, "SETTING_1", ["MODEL_1"]) });
    monetizationHistory.mockResolvedValue(emptyHistory);
});
afterEach(() => { cleanup(); localStorage.clear(); });

const model = (name: RegExp) => screen.getByRole("checkbox", { name });
const save = () => screen.getByRole("button", { name: "Save configuration" });

describe("Super Admin monetization settings", () => {
    it("says when monetization is not configured yet and waits for a choice", async () => {
        render(<SuperAdminMonetization />);
        expect(await screen.findByText("Not configured")).toBeTruthy();
        expect(screen.getByText(/Nothing changes for restaurants until plan features are released/)).toBeTruthy();
        expect((screen.getByRole("radio", { name: /Setting 1/ }) as HTMLInputElement).checked).toBe(false);
        expect((screen.getByRole("radio", { name: /Setting 2/ }) as HTMLInputElement).checked).toBe(false);
        expect((save() as HTMLButtonElement).disabled).toBe(true);
    });

    it("shows the current configuration and preselects it", async () => {
        monetizationConfig.mockResolvedValue({ data: config(3, "SETTING_2", ["MODEL_2", "MODEL_4"]) });
        render(<SuperAdminMonetization />);
        const current = await screen.findByRole("region", { name: "Current configuration" });
        expect(current.textContent).toContain("Setting 2");
        expect(current.textContent).toContain("Model 2");
        expect(current.textContent).toContain("Model 4");
        expect(current.textContent).toContain("Version 3");
        expect(current.textContent).toContain("r***@admin.test");
        expect((screen.getByRole("radio", { name: /Setting 2/ }) as HTMLInputElement).checked).toBe(true);
        expect((model(/Model 2/) as HTMLInputElement).checked).toBe(true);
        expect((model(/Model 3/) as HTMLInputElement).checked).toBe(false);
        expect((model(/Model 4/) as HTMLInputElement).checked).toBe(true);
    });

    it("keeps Setting 1 to Model 1 and Setting 2 to at least one of Models 2-4", async () => {
        render(<SuperAdminMonetization />);
        await screen.findByText("Not configured");
        fireEvent.click(screen.getByRole("radio", { name: /Setting 1/ }));
        for (const name of [/Model 2/, /Model 3/, /Model 4/]) expect((model(name) as HTMLInputElement).disabled).toBe(true);
        expect((save() as HTMLButtonElement).disabled).toBe(false);

        fireEvent.click(screen.getByRole("radio", { name: /Setting 2/ }));
        expect((model(/Model 3/) as HTMLInputElement).disabled).toBe(false);
        expect((save() as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText("Choose at least one of Models 2, 3 and 4.")).toBeTruthy();
        fireEvent.click(model(/Model 3/));
        expect((save() as HTMLButtonElement).disabled).toBe(false);
    });

    it("confirms old and new before saving, then shows the new version", async () => {
        monetizationConfig.mockResolvedValue({ data: config(1, "SETTING_1", ["MODEL_1"]) });
        saveMonetizationConfig.mockResolvedValue({ data: config(2, "SETTING_2", ["MODEL_2", "MODEL_4"]) });
        render(<SuperAdminMonetization />);
        await screen.findByRole("region", { name: "Current configuration" });
        fireEvent.click(screen.getByRole("radio", { name: /Setting 2/ }));
        fireEvent.click(model(/Model 4/));
        fireEvent.click(model(/Model 2/));
        fireEvent.click(save());

        const dialog = screen.getByRole("dialog", { name: "Change monetization configuration" });
        expect(dialog.textContent).toContain("Setting 1: Model 1");
        expect(dialog.textContent).toContain("Setting 2: Model 2, Model 4");
        expect(dialog.textContent).toContain("Existing subscriptions keep their terms until their renewal or transition date.");
        expect(saveMonetizationConfig).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

        await waitFor(() => expect(saveMonetizationConfig).toHaveBeenCalledWith({ setting: "SETTING_2", models: ["MODEL_2", "MODEL_4"], expectedVersion: 1 }));
        expect((await screen.findByRole("region", { name: "Current configuration" })).textContent).toContain("Version 2");
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(monetizationHistory).toHaveBeenCalledTimes(2); // reloaded after the save
    });

    it("cancelling the confirmation saves nothing", async () => {
        render(<SuperAdminMonetization />);
        await screen.findByText("Not configured");
        fireEvent.click(screen.getByRole("radio", { name: /Setting 1/ }));
        fireEvent.click(save());
        expect(screen.getByRole("dialog").textContent).toContain("Not configured");
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(saveMonetizationConfig).not.toHaveBeenCalled();
    });

    it("on a conflict says someone else saved first and reloads the latest version", async () => {
        saveMonetizationConfig.mockRejectedValue({ response: { status: 409, data: { code: "CONFIG_VERSION_CONFLICT",
            message: "The configuration was changed by someone else. Reload to see the latest version." } } });
        render(<SuperAdminMonetization />);
        await screen.findByText("Not configured");
        monetizationConfig.mockResolvedValue({ data: config(1, "SETTING_2", ["MODEL_3"]) });
        fireEvent.click(screen.getByRole("radio", { name: /Setting 1/ }));
        fireEvent.click(save());
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));

        expect((await screen.findByRole("alert")).textContent).toContain("changed by someone else");
        expect((await screen.findByRole("region", { name: "Current configuration" })).textContent).toContain("Model 3");
        expect(monetizationConfig).toHaveBeenCalledTimes(2);
    });

    it("lists the version history newest first in a keyboard-scrollable table", async () => {
        monetizationConfig.mockResolvedValue({ data: config(2, "SETTING_2", ["MODEL_2"]) });
        monetizationHistory.mockResolvedValue({ data: { items: [config(2, "SETTING_2", ["MODEL_2"]), config(1, "SETTING_1", ["MODEL_1"])], page: 0, size: 20, total: 2 } });
        render(<SuperAdminMonetization />);
        const region = await screen.findByRole("region", { name: "Configuration history (scrolls sideways)" });
        expect(region.getAttribute("tabindex")).toBe("0");
        const table = within(region).getByRole("table", { name: "Configuration history" });
        expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Version", "Setting", "Models", "Effective from", "Changed by"]);
        const rows = within(table).getAllByRole("row").slice(1);
        expect(rows[0].textContent).toContain("2");
        expect(rows[1].textContent).toContain("Setting 1");
        expect(monetizationHistory).toHaveBeenCalledWith(0, 20);
    });

    it("never touches the owner session", async () => {
        localStorage.setItem("token", "owner-token");
        render(<SuperAdminMonetization />);
        await screen.findByText("Not configured");
        fireEvent.click(screen.getByRole("radio", { name: /Setting 1/ }));
        fireEvent.click(save());
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));
        await waitFor(() => expect(saveMonetizationConfig).toHaveBeenCalled());
        expect(localStorage.getItem("token")).toBe("owner-token");
    });
});
