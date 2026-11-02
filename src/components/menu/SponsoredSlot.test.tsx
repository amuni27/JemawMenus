// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import SponsoredSlot from "./SponsoredSlot";

// AGF E4-M7 (AC7, C1): the one Agafari ad slot. Labelled "Sponsored" / "የተደገፈ ማስታወቂያ" by guest language, Amharic text when
// chosen and present (falls back to English), a new-tab link marked sponsored, alt text, nothing without an ad.

const ad = { adId: "a1", title: "Coffee week", body: "Try the new roast", linkUrl: "https://example.test/coffee" };
afterEach(cleanup);

describe("SponsoredSlot", () => {
    it("renders nothing without an ad", () => {
        const { container } = render(<SponsoredSlot ad={undefined} lang="en" />);
        expect(container.innerHTML).toBe("");
    });

    it("shows the English label, text and a sponsored new-tab link", () => {
        render(<SponsoredSlot ad={ad} lang="en" />);
        const slot = screen.getByRole("region", { name: "Sponsored" });
        expect(slot.textContent).toContain("Sponsored");
        expect(slot.textContent).toContain("Coffee week");
        expect(slot.textContent).toContain("Try the new roast");
        const link = within(slot).getByRole("link", { name: /Coffee week/ });
        expect(link.getAttribute("href")).toBe("https://example.test/coffee");
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toBe("sponsored noopener noreferrer");
    });

    it("uses the Amharic label and text in Amharic, falling back to English text", () => {
        render(<SponsoredSlot ad={{ ...ad, titleAm: "የቡና ሳምንት" }} lang="am" />);
        const slot = screen.getByRole("region", { name: "የተደገፈ ማስታወቂያ" });
        expect(slot.textContent).toContain("የቡና ሳምንት");
        expect(slot.textContent).toContain("Try the new roast"); // no Amharic text: English
    });

    it("shows the image with its alt text", () => {
        render(<SponsoredSlot ad={{ ...ad, imageUrl: "https://img.test/a.png", imageAlt: "A cup of coffee" }} lang="en" />);
        expect(screen.getByRole("img", { name: "A cup of coffee" }).getAttribute("src")).toBe("https://img.test/a.png");
    });

    // AD-D1 (PO-approved layout correction): the slot sits in the menu column like Specials and Chef's picks, with no extra
    // side inset of its own, and leaves the same space before the next section
    it("uses the menu sections' width and bottom spacing", () => {
        render(<SponsoredSlot ad={ad} lang="en" />);
        const slot = screen.getByRole("region", { name: "Sponsored" });
        const classes = slot.className.split(/\s+/);
        expect(classes).toEqual(expect.arrayContaining(["mb-10", "sm:mb-12"]));
        for (const inset of ["px-4", "mx-auto", "max-w-5xl", "mt-4"]) expect(classes).not.toContain(inset);
    });
});
