// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF FE-3 (register §52–§54): when saving the menu form is refused because publishing needs a plan (409) or a verified
// email (403), every typed value stays, the matching notice shows, and one click saves the work without publishing
// (create: unpublished; edit: the menu's original published state and visibility). Nothing is saved automatically.

const listMenuTypes = vi.fn().mockResolvedValue({ data: [{ id: "mt-lunch", name: "Lunch" }] });
vi.mock("../../api/menuApi", () => ({ default: { listMenuTypes } }));
const getPlan = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get: getPlan } }));
vi.mock("../../api/emailVerificationApi", () => ({ emailVerificationApi: { resend: vi.fn() } }));

const { default: MenuWizard } = await import("./MenuWizard.tsx");

const PLAN_MESSAGE = "Choose a plan to publish your menu. You can keep editing it meanwhile.";
const planRefusal = { response: { status: 409, data: { code: "PLAN_REQUIRED_TO_PUBLISH", message: PLAN_MESSAGE } } };
const verificationRefusal = { response: { status: 403, data: { code: "EMAIL_NOT_VERIFIED", message: "Verify your email to publish menus." } } };

function renderWizard(onSave: unknown, initial?: Record<string, unknown>) {
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/admin/menus/new"]}>
                <Routes>
                    <Route path="/:tenantSlug/admin/menus/new" element={<MenuWizard initial={initial as never} onSave={onSave as never} />} />
                    <Route path="/:tenantSlug/admin/plans" element={<p>Plans page</p>} />
                </Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const nameInput = () => screen.getAllByRole("textbox")[0] as HTMLInputElement;
const published = () => screen.getByRole("checkbox", { name: /Published/ }) as HTMLInputElement;
const submit = () => fireEvent.click(screen.getByRole("button", { name: /^(Save Menu|Update)$/ }));

async function fillNew() {
    await screen.findByRole("option", { name: "Lunch" });
    fireEvent.change(nameInput(), { target: { value: "Dinner" } });
    fireEvent.change(screen.getByLabelText("Menu Type"), { target: { value: "mt-lunch" } });
    fireEvent.change(document.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Evenings" } }); // the description
    fireEvent.click(published());
}

beforeEach(() => {
    getPlan.mockReset();
    getPlan.mockResolvedValue({ data: { visible: true } });
});
afterEach(() => cleanup());

describe("menu form: publishing refused", () => {
    it("create: keeps everything typed, explains, and saves it as a draft on one click", async () => {
        const onSave = vi.fn().mockRejectedValueOnce(planRefusal).mockResolvedValueOnce(undefined);
        renderWizard(onSave);
        await fillNew();
        submit();

        const alert = await screen.findByRole("region", { name: "Publishing refused" }); // the notice; its role="alert" is the message alone
        expect(alert.textContent).toContain(PLAN_MESSAGE);
        expect(within(alert).getByRole("link", { name: "Choose a plan" }).getAttribute("href")).toBe("/biz-1/admin/plans");
        expect(nameInput().value).toBe("Dinner");
        expect(published().checked).toBe(true);
        expect(onSave).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole("button", { name: "Save as draft instead" }));
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
        expect(onSave.mock.calls[1][0]).toMatchObject({ name: "Dinner", menuTypeId: "mt-lunch", description: "Evenings", isActive: false, visibility: "PUBLIC" });
    });

    it("edit: keeps the changes and saves them with the menu's original published state", async () => {
        const onSave = vi.fn().mockRejectedValueOnce(planRefusal).mockResolvedValueOnce(undefined);
        renderWizard(onSave, { name: "Lunch", menuTypeId: "mt-lunch", description: "", visibility: "PRIVATE", isActive: true });
        await screen.findByRole("option", { name: "Lunch" });
        fireEvent.change(nameInput(), { target: { value: "Brunch" } });
        fireEvent.change(screen.getByLabelText("Visibility", { exact: false }), { target: { value: "PUBLIC" } });
        submit();

        await screen.findByRole("alert");
        expect(nameInput().value).toBe("Brunch");
        fireEvent.click(screen.getByRole("button", { name: "Save my changes without publishing" }));
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
        expect(onSave.mock.calls[1][0]).toMatchObject({ name: "Brunch", isActive: true, visibility: "PRIVATE" });
    });

    it("a verification refusal shows verification guidance, no plan link, and the same way to save", async () => {
        const onSave = vi.fn().mockRejectedValueOnce(verificationRefusal).mockResolvedValueOnce(undefined);
        renderWizard(onSave);
        await fillNew();
        submit();

        const alert = await screen.findByRole("region", { name: "Publishing refused" }); // the notice; its role="alert" is the message alone
        expect(alert.textContent).toContain("Verify your email to publish menus.");
        expect(alert.textContent).not.toContain("Choose a plan");
        expect(within(alert).getByRole("button", { name: "Resend verification email" })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Save as draft instead" }));
        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
        expect(onSave.mock.calls[1][0]).toMatchObject({ name: "Dinner", isActive: false });
    });

    it("other errors keep their existing message and offer no draft action", async () => {
        const onSave = vi.fn().mockRejectedValueOnce({ response: { status: 500, data: { message: "Something went wrong" } } });
        renderWizard(onSave);
        await fillNew();
        submit();

        expect((await screen.findByRole("alert")).textContent).toBe("Something went wrong");
        expect(screen.queryByRole("button", { name: "Save as draft instead" })).toBeNull();
    });

    it("hints under Published when publishing needs a plan, without disabling it", async () => {
        getPlan.mockResolvedValue({ data: { visible: true, publishAllowed: false } });
        renderWizard(vi.fn());
        expect(await screen.findByText("Publishing needs a plan; you can save this menu as a draft.")).toBeTruthy();
        expect(published().disabled).toBe(false);
    });

    it.each([
        ["allowed", { visible: true, publishAllowed: true }],
        ["absent", { visible: true }],
    ])("shows no hint when publishing is %s", async (_label, data) => {
        getPlan.mockResolvedValue({ data });
        renderWizard(vi.fn());
        await screen.findByRole("option", { name: "Lunch" });
        await waitFor(() => expect(getPlan).toHaveBeenCalled());
        await new Promise((r) => setTimeout(r, 0));
        expect(screen.queryByText("Publishing needs a plan", { exact: false })).toBeNull();
    });
});
