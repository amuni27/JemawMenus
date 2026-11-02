// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// AGF E4-M8 (AC1, AC8, AC9, AC10, AC12): the owner's own ads. Schedules in the restaurant's time zone (shown, not
// selectable), with the offset choice for a time that occurs twice; "N of 20" safety cap; pause, resume, archive (with a
// confirmation); a suspended ad shows Agafari's reason and can be edited or archived but not paused or resumed; without a
// current Model 3 plan the page is read-only apart from Archive; image upload through presign → upload → confirm.

const api = vi.hoisted(() => ({
    list: vi.fn(), create: vi.fn(), update: vi.fn(), pause: vi.fn(), resume: vi.fn(), archive: vi.fn(),
    presignImage: vi.fn(), confirmImage: vi.fn(), removeImage: vi.fn(),
}));
vi.mock("../../api/restaurantAdsApi", () => ({ default: api }));

const { default: RestaurantAdsPage } = await import("./RestaurantAdsPage.tsx");

const ad = (over: Record<string, unknown> = {}) => ({
    id: "a1", businessId: "biz-1", title: "Lunch deal", body: "Two courses", linkUrl: "https://example.test/lunch", startsAt: "2026-12-01T06:00:00Z",
    scheduleTimeZone: "Africa/Addis_Ababa", startLocal: "2026-12-01T09:00", startOffset: "+03:00", status: "ACTIVE",
    createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", rowVersion: 2, ...over,
});
const view = (over: Record<string, unknown> = {}) => ({ canManage: true, cap: 20, nonArchivedCount: 1, timeZone: "Africa/Addis_Ababa", ads: [ad()], ...over });

beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.list.mockResolvedValue({ data: view() });
    api.create.mockResolvedValue({ data: ad({ id: "a2" }) });
    api.update.mockResolvedValue({ data: ad({ rowVersion: 3 }) });
    api.pause.mockResolvedValue({ data: ad({ status: "PAUSED" }) });
    api.archive.mockResolvedValue({ data: ad({ status: "ARCHIVED" }) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const table = () => screen.findByRole("table", { name: "Your ads" });

describe("the owner's restaurant ads", () => {
    it("lists ads with their schedule in the restaurant's time zone and the safety cap", async () => {
        render(<RestaurantAdsPage />);
        const t = await table();
        expect(t.textContent).toContain("Lunch deal");
        expect(t.textContent).toContain("Active");
        expect(t.textContent).toContain("2026-12-01 09:00 (Africa/Addis_Ababa, UTC+03:00)");
        expect(screen.getByText("1 of 20 ads in use (archived ads don't count)")).toBeTruthy();
        expect(screen.getByText("Ads must not be illegal, misleading or offensive. Agafari may suspend an ad that breaks these rules.")).toBeTruthy();
    });

    it("creates an ad in the restaurant's time zone, with a preview, and asks for the offset when the time occurs twice", async () => {
        api.list.mockResolvedValue({ data: view({ timeZone: "America/Chicago", ads: [] , nonArchivedCount: 0 }) });
        api.create.mockRejectedValueOnce({ response: { status: 400, data: { status: 400, fieldErrors: [
            { field: "startLocal", message: "This time occurs twice in America/Chicago; choose the offset (-05:00 or -06:00)" }] } } });
        render(<RestaurantAdsPage />);
        fireEvent.click(await screen.findByRole("button", { name: "New ad" }));
        const dialog = screen.getByRole("dialog", { name: "New ad" });
        expect(within(dialog).queryByLabelText("Time zone")).toBeNull(); // the restaurant's zone, not selectable
        fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Fall back" } });
        fireEvent.change(within(dialog).getByLabelText("Text"), { target: { value: "One hour twice" } });
        fireEvent.change(within(dialog).getByLabelText("Link (https)"), { target: { value: "https://example.test/fall" } });
        fireEvent.change(within(dialog).getByLabelText("Start (America/Chicago)"), { target: { value: "2026-11-01T01:30" } });
        expect(within(within(dialog).getByRole("region", { name: "Sponsored" })).getByText("Fall back")).toBeTruthy(); // preview
        fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
        await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ title: "Fall back", startLocal: "2026-11-01T01:30" })));
        expect(api.create.mock.calls[0][0]).not.toHaveProperty("timeZone");
        fireEvent.change(await within(dialog).findByLabelText("Start offset"), { target: { value: "-06:00" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
        await waitFor(() => expect(api.create).toHaveBeenLastCalledWith(expect.objectContaining({ startOffset: "-06:00" })));
    });

    it("pauses, edits with the stored offset, and archives with a confirmation", async () => {
        render(<RestaurantAdsPage />);
        await table();
        fireEvent.click(screen.getByRole("button", { name: "Pause Lunch deal" }));
        await waitFor(() => expect(api.pause).toHaveBeenCalledWith("a1", 2));
        fireEvent.click(screen.getByRole("button", { name: "Edit Lunch deal" }));
        const dialog = screen.getByRole("dialog", { name: "Edit ad" });
        expect((within(dialog).getByLabelText("Start (Africa/Addis_Ababa)") as HTMLInputElement).value).toBe("2026-12-01T09:00");
        fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
        await waitFor(() => expect(api.update).toHaveBeenCalledWith("a1", expect.objectContaining({ startLocal: "2026-12-01T09:00", startOffset: "+03:00", rowVersion: 2 })));
        fireEvent.click(screen.getByRole("button", { name: "Archive Lunch deal" }));
        fireEvent.click(within(screen.getByRole("dialog", { name: "Archive ad" })).getByRole("button", { name: "Archive" }));
        await waitFor(() => expect(api.archive).toHaveBeenCalledWith("a1", 2));
    });

    it("shows Agafari's suspension reason and offers only Edit and Archive for a suspended ad", async () => {
        api.list.mockResolvedValue({ data: view({ ads: [ad({ status: "SUSPENDED", suspensionReason: "Misleading price" })] }) });
        render(<RestaurantAdsPage />);
        const t = await table();
        expect(t.textContent).toContain("Suspended by Agafari");
        expect(t.textContent).toContain("Misleading price");
        expect(screen.queryByRole("button", { name: "Pause Lunch deal" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Resume Lunch deal" })).toBeNull();
        expect(screen.getByRole("button", { name: "Edit Lunch deal" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Archive Lunch deal" })).toBeTruthy();
    });

    it("is read-only apart from Archive without a current Model 3 plan", async () => {
        api.list.mockResolvedValue({ data: view({ canManage: false, ads: [ad(), ad({ id: "a3", title: "Paused one", status: "PAUSED" })], nonArchivedCount: 2 }) });
        render(<RestaurantAdsPage />);
        await table();
        expect(screen.getByText("Your plan doesn't include restaurant ads. You can view and archive your ads.")).toBeTruthy();
        expect(screen.queryByRole("button", { name: "New ad" })).toBeNull();
        expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();
        expect(screen.queryByRole("button", { name: /^Pause / })).toBeNull();
        expect(screen.queryByRole("button", { name: /^Resume / })).toBeNull();
        expect(screen.getByRole("button", { name: "Archive Paused one" })).toBeTruthy();
    });

    it("uploads an image through presign, upload and confirm with a description", async () => {
        api.presignImage.mockResolvedValue({ data: { uploadUrl: "https://r2.test.invalid/upload", objectKey: "restaurant-ad-asset/biz-1/a1/main.png", expiresInSeconds: 300 } });
        api.confirmImage.mockResolvedValue({ data: ad({ imageUrl: "https://img.test/a1.png", imageAlt: "A plate", rowVersion: 3 }) });
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal("fetch", fetchMock);
        render(<RestaurantAdsPage />);
        await table();
        fireEvent.click(screen.getByRole("button", { name: "Edit Lunch deal" }));
        const dialog = screen.getByRole("dialog", { name: "Edit ad" });
        fireEvent.change(within(dialog).getByLabelText("Image description"), { target: { value: "A plate" } });
        const file = new File(["x"], "plate.png", { type: "image/png" });
        fireEvent.change(within(dialog).getByLabelText("Image (JPEG, PNG or WebP, up to 8 MB)"), { target: { files: [file] } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Upload image" }));
        await waitFor(() => expect(api.confirmImage).toHaveBeenCalledWith("a1", "restaurant-ad-asset/biz-1/a1/main.png", "A plate", 2));
        expect(api.presignImage).toHaveBeenCalledWith("a1", "image/png");
        expect(fetchMock).toHaveBeenCalledWith("https://r2.test.invalid/upload", expect.objectContaining({ method: "PUT", body: file }));
    });
});
