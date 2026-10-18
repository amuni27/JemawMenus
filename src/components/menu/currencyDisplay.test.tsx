// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../ui/ToastContext";
import type { Category, MenuItem } from "../../types/menu";

// AGF-S2-02: owner and guest screens show the restaurant's currency; no hard-coded "$" or "ETB".

const get = vi.fn();
vi.mock("../../services/apiPublic.ts", () => ({ default: { get } }));
const updateBusiness = vi.fn();
vi.mock("../../api/profileApi", () => ({ profileApi: { updateBusiness } }));

const { default: ItemCard } = await import("./ItemCard.tsx");
const { default: ItemModal } = await import("./ItemModal.tsx");
const { default: MenuItemDetail } = await import("../../pages/customer/MenuItemDetail.tsx");
const { default: BusinessProfileModal } = await import("../account/BusinessProfileModal.tsx");

afterEach(cleanup);

const item: MenuItem = {
    id: "i1", menuId: "m1", categoryId: "c1", name: "Tibs", price: 420,
    ingredients: ["beef"], status: "AVAILABLE", createdAt: "", updatedAt: "",
};
const category: Category = { id: "c1", menuId: "m1", name: "Mains", isActive: true, sortOrder: 0, createdAt: "", updatedAt: "" };
const noop = () => {};

describe("owner screens", () => {
    it("admin item card shows the menu currency, never '$'", () => {
        render(<ItemCard item={item} currency="ETB" onEdit={noop} onToggle={noop} onDelete={noop} />);
        expect(screen.getByText("ETB 420.00")).toBeTruthy();
        expect(screen.queryByText(/\$/)).toBeNull();
        cleanup();

        render(<ItemCard item={item} currency="USD" onEdit={noop} onToggle={noop} onDelete={noop} />);
        expect(screen.getByText("USD 420.00")).toBeTruthy();
    });

    it("item form labels the price with the currency", () => {
        render(<ToastProvider><ItemModal open onClose={noop} menuId="m1" item={item} categories={[category]} currency="USD"
                                         onCreate={vi.fn()} onUpdate={vi.fn()} onConfirmImage={vi.fn()} /></ToastProvider>);
        expect(screen.getByText("Price (USD)")).toBeTruthy();
        expect(screen.queryByText("Price ($)")).toBeNull();
        cleanup();

        render(<ToastProvider><ItemModal open onClose={noop} menuId="m1" item={item} categories={[category]}
                                         onCreate={vi.fn()} onUpdate={vi.fn()} onConfirmImage={vi.fn()} /></ToastProvider>);
        expect(screen.getByText("Price (ETB)")).toBeTruthy();
    });

    it("business profile lets the owner choose ETB or USD", async () => {
        updateBusiness.mockResolvedValue({ data: {} });
        render(<ToastProvider><BusinessProfileModal open onClose={noop} onSaved={noop}
            business={{ id: "biz-1", name: "Cafe", currency: "ETB", createdAt: new Date(), updatedAt: new Date() }} /></ToastProvider>);

        const select = screen.getByLabelText("Currency") as HTMLSelectElement;
        expect(select.value).toBe("ETB");
        expect(Array.from(select.options).map((o) => o.value)).toEqual(["ETB", "USD"]);

        fireEvent.change(select, { target: { value: "USD" } });
        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => expect(updateBusiness).toHaveBeenCalledWith("biz-1", expect.objectContaining({ currency: "USD" })));
    });

    it("doesn't resend an unchanged or legacy currency with other profile edits", async () => {
        updateBusiness.mockReset();
        updateBusiness.mockResolvedValue({ data: {} });
        render(<ToastProvider><BusinessProfileModal open onClose={noop} onSaved={noop}
            business={{ id: "biz-1", name: "Cafe", currency: "GBP", createdAt: new Date(), updatedAt: new Date() }} /></ToastProvider>);

        expect((screen.getByLabelText("Currency") as HTMLSelectElement).value).toBe("GBP");
        expect(screen.getByRole("option", { name: "GBP (current)" })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => expect(updateBusiness).toHaveBeenCalled());
        expect(updateBusiness.mock.calls[0][1].currency).toBeUndefined();
    });
});

describe("guest item detail", () => {
    it("shows the restaurant's currency from the API instead of a hard-coded ETB", async () => {
        get.mockResolvedValue({ data: { id: "i1", name: "Burger", price: 12.5, ingredients: ["beef"], status: "AVAILABLE", currency: "USD" } });
        render(
            <MemoryRouter initialEntries={["/biz-1/menu/item/i1"]}>
                <Routes><Route path="/:tenantSlug/menu/item/:itemId" element={<MenuItemDetail />} /></Routes>
            </MemoryRouter>
        );
        expect((await screen.findAllByText("USD 12.50")).length).toBeGreaterThan(0);
        expect(screen.queryByText(/ETB/)).toBeNull();
    });
});
