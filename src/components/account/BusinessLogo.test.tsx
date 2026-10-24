// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../ui/ToastContext";

// AGF-S2-01: owners upload a logo through the secure presign → upload → confirm flow (S1-17 rules),
// can remove it, and guests see it, or the restaurant's initials when there is none.

const api = vi.hoisted(() => ({
    presignLogo: vi.fn(),
    confirmLogo: vi.fn(),
    removeLogo: vi.fn(),
    updateBusiness: vi.fn(),
    uploadToR2: vi.fn(),
}));
vi.mock("../../api/profileApi", () => ({
    profileApi: {
        presignLogo: api.presignLogo,
        confirmLogo: api.confirmLogo,
        removeLogo: api.removeLogo,
        updateBusiness: api.updateBusiness,
    },
}));
vi.mock("../../utils/r2Service", () => ({ uploadToR2: api.uploadToR2 }));
vi.mock("../../utils/r2Service.ts", () => ({ uploadToR2: api.uploadToR2 }));

const menuData = vi.hoisted(() => ({ value: { business: {} as Record<string, unknown>, menus: [] as unknown[] } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => auth.value }));

const { default: BusinessLogoModal } = await import("./BusinessLogoModal");
const { default: CustomerMenu } = await import("../../pages/customer/CustomerMenu.tsx");
const { default: AccountPage } = await import("../../pages/admin/AccountPage.tsx");

const MB = 1024 * 1024;
const LOGO = "https://images.example.test/business-logo-asset/biz-1/main.png";

function file(name: string, type: string, size = 2048) {
    const f = new File(["x"], name, { type });
    Object.defineProperty(f, "size", { value: size });
    return f;
}

beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
    URL.createObjectURL = () => "blob:preview";
    URL.revokeObjectURL = () => {};
});

beforeEach(() => {
    Object.values(api).forEach((m) => m.mockReset());
    api.presignLogo.mockResolvedValue({ data: { uploadUrl: "https://r2.example.test/upload?sig=1", objectKey: "business-logo-asset/biz-1/main.png" } });
    api.uploadToR2.mockResolvedValue(undefined);
    api.confirmLogo.mockResolvedValue({ data: { id: "biz-1", logoUrl: LOGO } });
    api.removeLogo.mockResolvedValue({ data: { id: "biz-1", logoUrl: null } });
});

afterEach(() => cleanup());

function renderModal(business: Record<string, unknown> = {}) {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(
        <ToastProvider>
            <BusinessLogoModal open onClose={onClose} onSaved={onSaved}
                               business={{ id: "biz-1", name: "Abol Cafe", createdAt: new Date(), updatedAt: new Date(), ...business }} />
        </ToastProvider>
    );
    return { onSaved, onClose };
}

const fileInput = () => screen.getByLabelText(/logo image/i) as HTMLInputElement;
const choose = (f: File) => fireEvent.change(fileInput(), { target: { files: [f] } });

describe("logo modal", () => {
    it("offers a file picker, not a URL field", () => {
        renderModal();
        expect(fileInput().type).toBe("file");
        expect(fileInput().accept).toBe("image/jpeg,image/png,image/webp");
        expect(screen.queryByPlaceholderText(/https:\/\//)).toBeNull();
        expect(screen.queryByText("Logo URL")).toBeNull();
    });

    it("uploads a PNG through presign → upload → confirm and refreshes the account", async () => {
        const { onSaved, onClose } = renderModal();
        const png = file("My Logo.png", "image/png");
        choose(png);
        fireEvent.click(screen.getByRole("button", { name: "Save Logo" }));

        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(api.presignLogo).toHaveBeenCalledWith("biz-1", { fileName: "My Logo.png", contentType: "image/png" });
        expect(api.uploadToR2).toHaveBeenCalledWith("https://r2.example.test/upload?sig=1", png);
        expect(api.confirmLogo).toHaveBeenCalledWith("biz-1", "business-logo-asset/biz-1/main.png");
        expect(api.updateBusiness).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
        expect(await screen.findByText("Logo updated")).toBeTruthy();
    });

    it.each([
        ["menu.pdf", "application/pdf", 2048, "Unsupported image type. Upload a JPEG, PNG or WebP image."],
        ["IMG_0001.HEIC", "image/heic", 2048, "HEIC photos aren't supported yet. Please upload a JPEG, PNG or WebP image."],
        ["huge.png", "image/png", 9 * MB, "Image is too large. The maximum size is 8 MB."],
    ])("rejects %s with the S1-17 message and uploads nothing", async (name, type, size, message) => {
        renderModal();
        choose(file(name, type, size));

        expect(screen.getByText(message)).toBeTruthy();
        const save = screen.getByRole("button", { name: "Save Logo" }) as HTMLButtonElement;
        expect(save.disabled).toBe(true);
        fireEvent.click(save);
        await Promise.resolve();
        expect(api.presignLogo).not.toHaveBeenCalled();
        expect(api.uploadToR2).not.toHaveBeenCalled();
        expect(api.confirmLogo).not.toHaveBeenCalled();
    });

    it("shows the server message and does not confirm when the upload fails", async () => {
        api.uploadToR2.mockRejectedValue(new Error("Upload failed (403): SignatureDoesNotMatch"));
        const { onSaved } = renderModal();
        choose(file("logo.png", "image/png"));
        fireEvent.click(screen.getByRole("button", { name: "Save Logo" }));

        expect(await screen.findByText(/couldn't upload the logo/i)).toBeTruthy();
        expect(api.confirmLogo).not.toHaveBeenCalled();
        expect(onSaved).not.toHaveBeenCalled();
    });

    it("shows the backend message when confirm rejects the file", async () => {
        api.confirmLogo.mockRejectedValue({ response: { status: 400, data: { message: "Image is too large. The maximum size is 8 MB." } } });
        renderModal();
        choose(file("logo.png", "image/png"));
        fireEvent.click(screen.getByRole("button", { name: "Save Logo" }));
        expect(await screen.findByText("Image is too large. The maximum size is 8 MB.")).toBeTruthy();
    });

    it("removes an existing logo", async () => {
        const { onSaved } = renderModal({ logoUrl: LOGO });
        expect((screen.getByRole("img", { name: /abol cafe logo/i }) as HTMLImageElement).src).toBe(LOGO);

        fireEvent.click(screen.getByRole("button", { name: "Remove logo" }));
        await waitFor(() => expect(api.removeLogo).toHaveBeenCalledWith("biz-1"));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(api.presignLogo).not.toHaveBeenCalled();
    });

    it("offers no Remove button when there is no logo", () => {
        renderModal();
        expect(screen.queryByRole("button", { name: "Remove logo" })).toBeNull();
        expect(screen.getByText("AC")).toBeTruthy();
    });
});

function renderGuestMenu(business: Record<string, unknown>) {
    menuData.value = { business: { id: "biz-1", name: "Abol Cafe", ...business }, menus: [] };
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes><Route path="/:tenantSlug/menu" element={<CustomerMenu />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
    return screen.getByRole("banner");
}

describe("guest menu header", () => {
    it("shows the restaurant's own logo", () => {
        const header = renderGuestMenu({ logoUrl: LOGO });
        expect((within(header).getByRole("img", { name: /abol cafe logo/i }) as HTMLImageElement).src).toBe(LOGO);
        expect(document.body.innerHTML).not.toContain("spotapps");
    });

    it("shows the initials and requests no image when there is no logo", () => {
        const header = renderGuestMenu({ logoUrl: null });
        expect(within(header).getByText("AC")).toBeTruthy();
        expect(header.querySelector("img")).toBeNull();
        expect(document.body.innerHTML).not.toContain("spotapps");
    });

    it("falls back to the initials if the logo fails to load", () => {
        const header = renderGuestMenu({ logoUrl: LOGO });
        fireEvent.error(within(header).getByRole("img", { name: /abol cafe logo/i }));
        expect(within(header).getByText("AC")).toBeTruthy();
        expect(header.querySelector("img")).toBeNull();
    });
});

describe("account page logo card", () => {
    const setAuth = (business: Record<string, unknown>) => {
        auth.value = {
            user: { id: "u1", fullName: "Demo Owner", email: "owner@example.com", role: "VENUE" },
            business: { id: "biz-1", name: "Abol Cafe", currency: "ETB", ...business },
            refresh: vi.fn(),
        };
    };
    const renderAccount = () => render(<ToastProvider><MemoryRouter><AccountPage /></MemoryRouter></ToastProvider>);

    it("shows the saved logo", () => {
        setAuth({ logoUrl: LOGO });
        renderAccount();
        expect((screen.getByRole("img", { name: /abol cafe logo/i }) as HTMLImageElement).src).toBe(LOGO);
    });

    it("shows the business initials when there is no logo", () => {
        setAuth({ logoUrl: undefined });
        renderAccount();
        expect(screen.getByText("AC")).toBeTruthy();
        expect(screen.queryByRole("img", { name: /abol cafe logo/i })).toBeNull();
    });
});
