// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PrivacyNotice, { MENU_VIEWS_NOTICE } from "./PrivacyNotice";

// AGF-S2-24 (D-S2-24-2, -3): the guest menu footer's "Privacy" link opens the approved menu-views notice in an
// accessible dialog (S2-27 rules: focus moves in, Escape closes, focus returns to the link).

afterEach(() => cleanup());

describe("guest privacy notice", () => {
    it("uses exactly the approved wording", () => {
        expect(MENU_VIEWS_NOTICE).toBe(
            "To show restaurants how often their menu is opened, Agafari counts menu openings per restaurant and per day. "
            + "We don't use cookies for this and don't store your IP address, device or any other information that identifies you. "
            + "Restaurants see only the daily totals."
        );
    });

    it("opens the notice in a labelled dialog and closes it with Escape, returning focus", () => {
        render(<PrivacyNotice />);
        const link = screen.getByRole("button", { name: "Privacy" });
        expect(screen.queryByRole("dialog")).toBeNull();

        link.focus();
        fireEvent.click(link);
        const dialog = screen.getByRole("dialog", { name: "Menu views" });
        expect(dialog.getAttribute("aria-modal")).toBe("true");
        expect(dialog.textContent).toContain(MENU_VIEWS_NOTICE);
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close privacy notice" }));

        fireEvent.keyDown(dialog, { key: "Escape" });
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(document.activeElement).toBe(link);
    });

    it("reads left-aligned even inside the centred footer", () => {
        render(<footer className="text-center"><PrivacyNotice /></footer>);
        fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
        expect(screen.getByRole("dialog").className).toContain("text-left");
    });

    it("closes with the Close button", () => {
        render(<PrivacyNotice />);
        fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
        fireEvent.click(screen.getByRole("button", { name: "Close privacy notice" }));
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
