// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// AGF-S2-29: the landing page describes only what Agafari does today (no deals, adverts, sub-domains or prices).

const { default: Landing } = await import("./Landing.tsx");

afterEach(() => cleanup());

const renderLanding = () => render(<MemoryRouter><Landing /></MemoryRouter>);

describe("landing page copy", () => {
    it("promises no deals, adverts, specials, sub-domains, prices or free plans", () => {
        renderLanding();
        const text = document.body.textContent ?? "";
        expect(text).not.toMatch(/deal|advert|special|sub-?domain|\$\d|pricing|free/i);
    });

    it("describes the real features", () => {
        renderLanding();
        expect(screen.getByText(/Manage beautiful digital menus from one dashboard/)).toBeTruthy();
        expect(screen.getByText(/Mark dishes sold out, update prices and items/)).toBeTruthy();
        expect(screen.getByText(/its own menu link, logo and dashboard/)).toBeTruthy();
    });

    it("offers Get started and Log in", () => {
        renderLanding();
        expect(screen.getByRole("link", { name: "Get started" }).getAttribute("href")).toBe("/auth/register");
        expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/auth/login");
    });
});
