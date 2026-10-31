// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import GuestInfoPanel from "./GuestInfoPanel";

// AGF-S2-12 (D-S2-12-4): with a saved Google Maps link the guest sees "Get Directions" (new tab) and the address as text;
// without one, the S2-03 address search link stays. Never both.

afterEach(cleanup);

const base = { streetAddress: "Bole Road 1", city: "Addis Ababa", businessPhone: "+251 11 000 0000" };
const panel = () => screen.getByRole("region", { name: "Restaurant information" });

describe("guest location link", () => {
    it("shows Get Directions to the saved link and no address search link", () => {
        render(<GuestInfoPanel business={{ ...base, locationUrl: "https://maps.app.goo.gl/AbC123xyz" }} />);
        const directions = within(panel()).getByRole("link", { name: /Get Directions/ });
        expect(directions.getAttribute("href")).toBe("https://maps.app.goo.gl/AbC123xyz");
        expect(directions.getAttribute("target")).toBe("_blank");
        expect(directions.getAttribute("rel")).toBe("noopener noreferrer");
        expect(within(panel()).getByText("Bole Road 1, Addis Ababa")).toBeTruthy();
        expect(within(panel()).queryByRole("link", { name: /Bole Road 1/ })).toBeNull();
        expect(panel().innerHTML).not.toContain("maps/search");
    });

    it("keeps the address search link and shows no Get Directions without a saved link", () => {
        render(<GuestInfoPanel business={{ ...base, locationUrl: null }} />);
        expect(within(panel()).queryByRole("link", { name: /Get Directions/ })).toBeNull();
        expect(within(panel()).getByRole("link", { name: /Bole Road 1, Addis Ababa/ }).getAttribute("href")).toContain("maps/search");
    });

    it("shows Get Directions even when no address is stored", () => {
        render(<GuestInfoPanel business={{ locationUrl: "https://goo.gl/maps/Xyz" }} />);
        expect(within(panel()).getByRole("link", { name: /Get Directions/ })).toBeTruthy();
    });
});
