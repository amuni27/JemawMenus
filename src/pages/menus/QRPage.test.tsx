// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// AGF-S2-20: the QR page encodes the configured guest menu address, prints the A5 sheet and the table tent, downloads
// with safe file names, and shows no QR at all when the configured address is invalid (fail closed, D2).

const qrProps = vi.hoisted(() => ({ last: null as null | Record<string, unknown> }));
vi.mock("react-qr-code", () => ({
    default: (props: Record<string, unknown>) => {
        qrProps.last = props;
        return <svg data-testid="qr" data-value={String(props.value)}><path d="M0 0h1v1H0z" /></svg>;
    },
}));

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => auth.value }));

const { default: QRPage } = await import("./QRPage.tsx");

let written = "";
beforeEach(() => {
    qrProps.last = null;
    written = "";
    auth.value = { business: { id: "biz-1", name: `Abol <Café>`, logoUrl: "https://images.test.invalid/logo.png" } };
    vi.stubGlobal("open", vi.fn(() => ({
        document: { open: vi.fn(), write: (html: string) => { written += html; }, close: vi.fn() },
        focus: vi.fn(),
    })));
});
afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const renderPage = () => render(<MemoryRouter><QRPage /></MemoryRouter>);

describe("QR page", () => {
    // AC2, AC11
    it("encodes exactly the displayed, configured guest menu address with error correction M", () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "http://localhost:5175/");
        renderPage();

        expect(qrProps.last?.value).toBe("http://localhost:5175/biz-1/menu");
        expect(qrProps.last?.level).toBe("M");
        expect(screen.getByRole("link", { name: "http://localhost:5175/biz-1/menu" })).toBeTruthy();
    });

    // AC1
    it("keeps the existing address when nothing is configured", () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "");
        renderPage();
        expect(qrProps.last?.value).toBe("https://agafari-menu.onrender.com/biz-1/menu");
    });

    // AC13
    it("offers PNG, SVG, A5 sheet and table tent actions", () => {
        renderPage();
        for (const name of ["Download PNG", "Download SVG", "Print A5 sheet", "Print table tent"]) {
            expect(screen.getByRole("button", { name })).toBeTruthy();
        }
        expect(screen.queryByRole("button", { name: "Print" })).toBeNull();
    });

    // AC4, AC13
    it("shows an alert and no QR, download or print when the configured address is invalid", () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "ftp://menu.example.test");
        renderPage();

        expect(screen.getByRole("alert").textContent).toContain("The guest menu address isn't configured correctly");
        expect(screen.queryByTestId("qr")).toBeNull();
        expect(qrProps.last).toBeNull();
        expect(screen.queryByRole("button", { name: /Download|Print/ })).toBeNull();
    });

    // AC6, AC9
    it("prints the A5 sheet with the escaped name, logo, QR and address", () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "http://localhost:5175");
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: "Print A5 sheet" }));

        expect(window.open).toHaveBeenCalledTimes(1);
        expect(written).toContain("size: A5 portrait");
        expect(written).toContain("Abol &lt;Café&gt;");
        expect(written).not.toContain("Abol <Café>");
        expect(written).toContain('src="https://images.test.invalid/logo.png"');
        expect(written).toContain('data-value="http://localhost:5175/biz-1/menu"');
        expect(written).toContain("http://localhost:5175/biz-1/menu</");
    });

    // AC7, AC8
    it("prints the table tent, without a logo when the restaurant has none", () => {
        auth.value = { business: { id: "biz-1", name: "Abol", logoUrl: null } };
        renderPage();
        fireEvent.click(screen.getByRole("button", { name: "Print table tent" }));

        expect(written).toContain("size: A4 landscape");
        expect(written).toContain('class="panel flipped"');
        expect(written).not.toContain("<img");
    });

    // AC9, AC10
    it("downloads the SVG with a safe file name", () => {
        const created = vi.fn(() => "blob:qr");
        vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
        const names: string[] = [];
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            names.push(this.download);
        });
        renderPage();

        fireEvent.click(screen.getByRole("button", { name: "Download SVG" }));

        expect(created).toHaveBeenCalledTimes(1);
        expect(names).toEqual(["abol-caf-qr.svg"]);
    });
});
