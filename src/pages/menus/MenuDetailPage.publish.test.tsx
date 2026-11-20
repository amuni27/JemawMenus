// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF FE-3 (register §52–§54): on the menu page, a 409 PLAN_REQUIRED_TO_PUBLISH explains and links to Subscription & Plans;
// a 403 EMAIL_NOT_VERIFIED shows verification guidance instead (never a plan link). With publishAllowed false (BE-5b) a
// hint shows before the click (Publish stays enabled, F-1) and Unpublish asks first; with true or absent nothing changes.

const getMenu = vi.fn();
const updateMenu = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { getMenu, updateMenu } }));
const getPlan = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get: getPlan } }));
const resend = vi.fn();
vi.mock("../../api/emailVerificationApi", () => ({ emailVerificationApi: { resend } }));
vi.mock("../../hooks/useCategories", () => ({ useCategories: () => ({ categories: [], loading: false, error: "" }) }));
vi.mock("../../hooks/useItems.ts", () => ({ useItems: () => ({ items: [] }) }));
vi.mock("../../components/menu/CategoryPanel.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/ItemsPanel.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/CategoryModal.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/ItemModal.tsx", () => ({ default: () => null }));

const { default: MenuDetailPage } = await import("./MenuDetailPage.tsx");

const menu = (active: boolean) => ({ id: "m1", businessId: "biz-1", name: "Lunch", active, visibility: "PUBLIC", currency: "ETB" });
const refusal = (status: number, code: string, message: string) => ({ response: { status, data: { code, message } } });
const PLAN_MESSAGE = "Choose a plan to publish your menu. You can keep editing it meanwhile.";

function Page() {
    return (
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/admin/menus/m1"]}>
                <Routes>
                    <Route path="/:tenantSlug/admin/menus/:menuId" element={<MenuDetailPage />} />
                    <Route path="/:tenantSlug/admin/plans" element={<p>Plans page</p>} />
                </Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const plan = (data: Record<string, unknown>) => getPlan.mockResolvedValue({ data: { visible: true, ...data } });

beforeEach(() => {
    for (const fn of [getMenu, updateMenu, getPlan, resend]) fn.mockReset();
    getMenu.mockResolvedValue({ data: menu(false) });
    plan({});
});
afterEach(() => cleanup());

const publishButton = () => screen.findByRole("button", { name: "Publish" });

describe("menu page publishing", () => {
    it("explains a plan refusal and links to Subscription & Plans", async () => {
        updateMenu.mockRejectedValue(refusal(409, "PLAN_REQUIRED_TO_PUBLISH", PLAN_MESSAGE));
        render(<Page />);
        fireEvent.click(await publishButton());

        const alert = await screen.findByRole("region", { name: "Publishing refused" }); // the notice; its role="alert" is the message alone
        expect(alert.textContent).toContain(PLAN_MESSAGE);
        expect(within(alert).getByRole("alert").textContent).toBe(PLAN_MESSAGE); // announced alone
        expect(alert.textContent).not.toContain("Verify your email");
        expect(screen.getByText("Unpublished")).toBeTruthy(); // the badge didn't change
        fireEvent.click(within(alert).getByRole("link", { name: "Choose a plan" }));
        expect(await screen.findByText("Plans page")).toBeTruthy();
    });

    it("shows verification guidance, not a plan link, when the email isn't verified", async () => {
        updateMenu.mockRejectedValue(refusal(403, "EMAIL_NOT_VERIFIED", "Verify your email to publish menus."));
        resend.mockResolvedValue({ data: {} });
        render(<Page />);
        fireEvent.click(await publishButton());

        const alert = await screen.findByRole("region", { name: "Publishing refused" }); // the notice; its role="alert" is the message alone
        expect(within(alert).getByRole("alert").textContent).toBe("Verify your email to publish menus."); // as J17 expects
        expect(within(alert).queryByRole("link", { name: "Choose a plan" })).toBeNull();
        fireEvent.click(within(alert).getByRole("button", { name: "Resend verification email" }));
        await waitFor(() => expect(resend).toHaveBeenCalledTimes(1));
        expect(await within(alert).findByText("Verification email sent.")).toBeTruthy();
    });

    it("says to contact the team, without a dead-end link, while plans are hidden", async () => {
        getPlan.mockResolvedValue({ data: { visible: false } });
        updateMenu.mockRejectedValue(refusal(409, "PLAN_REQUIRED_TO_PUBLISH", PLAN_MESSAGE));
        render(<Page />);
        fireEvent.click(await publishButton());

        const alert = await screen.findByRole("region", { name: "Publishing refused" }); // the notice; its role="alert" is the message alone
        expect(alert.textContent).toContain("Contact the Agafari team to choose a plan.");
        expect(within(alert).queryByRole("link")).toBeNull();
    });

    it("keeps other errors as they were", async () => {
        updateMenu.mockRejectedValue({ response: { status: 500, data: { message: "Something went wrong" } } });
        render(<Page />);
        fireEvent.click(await publishButton());

        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toBe("Something went wrong");
    });

    it("hints before the click when publishing needs a plan, and still lets the owner try", async () => {
        plan({ publishAllowed: false });
        updateMenu.mockResolvedValue({ data: { ...menu(true) } });
        render(<Page />);
        const hint = await screen.findByText("Publishing needs a plan.", { exact: false });
        expect(within(hint).getByRole("link", { name: "Choose a plan" })).toBeTruthy();

        const button = await publishButton();
        expect((button as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(button);
        await waitFor(() => expect(updateMenu).toHaveBeenCalledWith("m1", { isActive: true }));
    });

    it.each([
        ["allowed (entitled or exempt)", { publishAllowed: true }],
        ["absent (gate off)", {}],
    ])("shows no hint and unpublishes at once when publishing is %s", async (_label, data) => {
        plan(data);
        getMenu.mockResolvedValue({ data: menu(true) });
        updateMenu.mockResolvedValue({ data: menu(false) });
        render(<Page />);
        fireEvent.click(await screen.findByRole("button", { name: "Unpublish" }));

        await waitFor(() => expect(updateMenu).toHaveBeenCalledWith("m1", { isActive: false }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.queryByText("Publishing needs a plan.", { exact: false })).toBeNull();
    });

    it("unpublishes at once when the plan can't be read", async () => {
        getPlan.mockRejectedValue(new Error("network"));
        getMenu.mockResolvedValue({ data: menu(true) });
        updateMenu.mockResolvedValue({ data: menu(false) });
        render(<Page />);
        fireEvent.click(await screen.findByRole("button", { name: "Unpublish" }));
        await waitFor(() => expect(updateMenu).toHaveBeenCalledWith("m1", { isActive: false }));
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("warns before unpublishing when the menu couldn't be published again", async () => {
        plan({ publishAllowed: false });
        getMenu.mockResolvedValue({ data: menu(true) });
        updateMenu.mockResolvedValue({ data: menu(false) });
        render(<Page />);
        await waitFor(() => expect(getPlan).toHaveBeenCalled());
        await new Promise((r) => setTimeout(r, 0)); // the plan answer has arrived
        fireEvent.click(await screen.findByRole("button", { name: "Unpublish" }));

        const dialog = await screen.findByRole("dialog", { name: "Unpublish this menu?" });
        expect(dialog.textContent).toContain("Guests won't see it, and you can't publish it again until you choose a plan.");
        const keep = within(dialog).getByRole("button", { name: "Keep it published" });
        expect(document.activeElement).toBe(keep);
        fireEvent.click(keep);
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(updateMenu).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(updateMenu).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
        fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Unpublish" }));
        await waitFor(() => expect(updateMenu).toHaveBeenCalledWith("m1", { isActive: false }));
        expect(await screen.findByRole("button", { name: "Publish" })).toBeTruthy();
    });
});
