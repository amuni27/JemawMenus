// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// AGF E4-M7 (AC1, AC2, AC8, AC15): the Super Admin's Agafari ads page. List with status, schedule in its own time zone and
// "Served impressions" (delivery, not visibility); create and edit with an explicit time zone shown beside the date-time
// fields, the offset choice for a time that occurs twice, edit pre-fill that keeps the exact instant; pause, resume and
// archive; image upload through presign → upload → confirm with alt text.

const ads = vi.fn();
const createAd = vi.fn();
const updateAd = vi.fn();
const pauseAd = vi.fn();
const resumeAd = vi.fn();
const archiveAd = vi.fn();
const presignAdImage = vi.fn();
const confirmAdImage = vi.fn();
const removeAdImage = vi.fn();
vi.mock("../../api/adminApi", async (orig) => ({
    ...(await orig<typeof import("../../api/adminApi")>()),
    adminApi: { ads, createAd, updateAd, pauseAd, resumeAd, archiveAd, presignAdImage, confirmAdImage, removeAdImage },
}));

const { default: SuperAdminAds } = await import("./SuperAdminAds.tsx");

const ad = (over: Record<string, unknown> = {}) => ({
    id: "a1", title: "Coffee week", body: "Try the new roast", linkUrl: "https://example.test/coffee", startsAt: "2026-11-01T07:30:00Z",
    scheduleTimeZone: "America/Chicago", startLocal: "2026-11-01T01:30", startOffset: "-06:00", status: "ACTIVE", servedImpressions: 42,
    createdAt: "2026-10-30T10:00:00Z", updatedAt: "2026-10-30T10:00:00Z", rowVersion: 3, ...over,
});
const overlap = { response: { status: 400, data: { status: 400, message: "Validation failed", fieldErrors: [
    { field: "startLocal", message: "This time occurs twice in America/Chicago; choose the offset (-05:00 or -06:00)" }] } } };

beforeEach(() => {
    for (const fn of [ads, createAd, updateAd, pauseAd, resumeAd, archiveAd, presignAdImage, confirmAdImage, removeAdImage]) fn.mockReset();
    ads.mockResolvedValue({ data: [ad()] });
    createAd.mockResolvedValue({ data: ad({ id: "a2" }) });
    updateAd.mockResolvedValue({ data: ad({ rowVersion: 4 }) });
    pauseAd.mockResolvedValue({ data: ad({ status: "PAUSED", rowVersion: 4 }) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const table = () => screen.findByRole("table", { name: "Agafari ads" });

describe("Super Admin Agafari ads", () => {
    it("lists ads with their schedule in its own time zone and served impressions explained", async () => {
        render(<SuperAdminAds />);
        const t = await table();
        expect(t.textContent).toContain("Coffee week");
        expect(t.textContent).toContain("Active");
        expect(t.textContent).toContain("2026-11-01 01:30 (America/Chicago, UTC-06:00)");
        expect(t.textContent).toContain("Served impressions");
        expect(t.textContent).toContain("42");
        expect(screen.getByText("Counted when the ad is delivered with a menu; this doesn't confirm the ad was seen on screen.")).toBeTruthy();
    });

    it("creates an ad in an explicit time zone and asks for the offset when the time occurs twice", async () => {
        createAd.mockRejectedValueOnce(overlap);
        render(<SuperAdminAds />);
        await table();
        fireEvent.click(screen.getByRole("button", { name: "New ad" }));
        const dialog = screen.getByRole("dialog", { name: "New ad" });
        fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Fall back" } });
        fireEvent.change(within(dialog).getByLabelText("Text"), { target: { value: "One hour twice" } });
        fireEvent.change(within(dialog).getByLabelText("Link (https)"), { target: { value: "https://example.test/fall" } });
        fireEvent.change(within(dialog).getByLabelText("Time zone"), { target: { value: "America/Chicago" } });
        expect(within(dialog).getByLabelText("Start (America/Chicago)")).toBeTruthy(); // the zone is shown beside the fields
        fireEvent.change(within(dialog).getByLabelText("Start (America/Chicago)"), { target: { value: "2026-11-01T01:30" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
        await waitFor(() => expect(createAd).toHaveBeenCalledWith(expect.objectContaining({ title: "Fall back", body: "One hour twice",
            linkUrl: "https://example.test/fall", timeZone: "America/Chicago", startLocal: "2026-11-01T01:30" })));
        expect(await within(dialog).findByText(/occurs twice in America\/Chicago/)).toBeTruthy();
        const offset = within(dialog).getByLabelText("Start offset");
        expect([...offset.querySelectorAll("option")].map((o) => o.textContent)).toEqual(expect.arrayContaining(["-05:00", "-06:00"]));
        fireEvent.change(offset, { target: { value: "-06:00" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
        await waitFor(() => expect(createAd).toHaveBeenLastCalledWith(expect.objectContaining({ startOffset: "-06:00" })));
    });

    it("pre-fills an edit with the stored local time and offset so saving unchanged keeps the instant", async () => {
        render(<SuperAdminAds />);
        await table();
        fireEvent.click(screen.getByRole("button", { name: "Edit Coffee week" }));
        const dialog = screen.getByRole("dialog", { name: "Edit ad" });
        expect((within(dialog).getByLabelText("Time zone") as HTMLSelectElement).value).toBe("America/Chicago");
        expect((within(dialog).getByLabelText("Start (America/Chicago)") as HTMLInputElement).value).toBe("2026-11-01T01:30");
        fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
        await waitFor(() => expect(updateAd).toHaveBeenCalledWith("a1", expect.objectContaining({ startLocal: "2026-11-01T01:30", startOffset: "-06:00",
            timeZone: "America/Chicago", rowVersion: 3 })));
    });

    it("pauses, resumes and archives (with a confirmation)", async () => {
        resumeAd.mockResolvedValue({ data: ad() });
        archiveAd.mockResolvedValue({ data: ad({ status: "ARCHIVED" }) });
        render(<SuperAdminAds />);
        await table();
        fireEvent.click(screen.getByRole("button", { name: "Pause Coffee week" }));
        await waitFor(() => expect(pauseAd).toHaveBeenCalledWith("a1", 3));
        ads.mockResolvedValue({ data: [ad({ status: "PAUSED", rowVersion: 4 })] });
        cleanup();
        render(<SuperAdminAds />);
        await table();
        fireEvent.click(screen.getByRole("button", { name: "Resume Coffee week" }));
        await waitFor(() => expect(resumeAd).toHaveBeenCalledWith("a1", 4));
        fireEvent.click(screen.getByRole("button", { name: "Archive Coffee week" }));
        fireEvent.click(within(screen.getByRole("dialog", { name: "Archive ad" })).getByRole("button", { name: "Archive" }));
        await waitFor(() => expect(archiveAd).toHaveBeenCalledWith("a1", 4));
    });

    it("uploads an image through presign, upload and confirm with alt text", async () => {
        presignAdImage.mockResolvedValue({ data: { uploadUrl: "https://r2.test.invalid/upload", objectKey: "agafari-ad-asset/a1/main.png", expiresInSeconds: 300 } });
        confirmAdImage.mockResolvedValue({ data: ad({ imageUrl: "https://img.test/a1.png", imageAlt: "A cup", rowVersion: 4 }) });
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal("fetch", fetchMock);
        render(<SuperAdminAds />);
        await table();
        fireEvent.click(screen.getByRole("button", { name: "Edit Coffee week" }));
        const dialog = screen.getByRole("dialog", { name: "Edit ad" });
        fireEvent.change(within(dialog).getByLabelText("Image description"), { target: { value: "A cup" } });
        const file = new File(["x"], "cup.png", { type: "image/png" });
        fireEvent.change(within(dialog).getByLabelText("Image (JPEG, PNG or WebP, up to 8 MB)"), { target: { files: [file] } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Upload image" }));
        await waitFor(() => expect(confirmAdImage).toHaveBeenCalledWith("a1", "agafari-ad-asset/a1/main.png", "A cup", 3));
        expect(presignAdImage).toHaveBeenCalledWith("a1", "image/png");
        expect(fetchMock).toHaveBeenCalledWith("https://r2.test.invalid/upload", expect.objectContaining({ method: "PUT", body: file }));
    });
});
