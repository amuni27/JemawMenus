// @vitest-environment jsdom
/// <reference types="node" />
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import Button from "./Button";

// AGF D-8 (register §61, option A): white text on the brand pink #FF385C is 3.52:1, below WCAG AA (4.5:1). White-text brand
// fills use brand-dark #E11D48 (4.70:1) with rose-700 #BE123C on hover (6.29:1), as VerifyEmail already did. Focus rings,
// borders and other brand accents are unchanged.

afterEach(() => cleanup());

const PLAIN_BRAND_FILL = /(^|[\s"'`])(hover:)?bg-brand(?![-/\w])/; // bg-brand / hover:bg-brand, not bg-brand-dark or bg-brand/40

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = join(dir, e.name);
        if (e.isDirectory()) return sourceFiles(p);
        return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
    });
}

describe("brand fills with white text meet WCAG AA contrast", () => {
    it("the primary button uses brand-dark with a darker hover", () => {
        render(<Button>Save</Button>);
        const classes = screen.getByRole("button", { name: "Save" }).className.split(/\s+/);
        expect(classes).toContain("bg-brand-dark");
        expect(classes).toContain("hover:bg-rose-700");
        expect(classes).toContain("text-white");
        expect(classes).not.toContain("bg-brand");
        expect(classes).toContain("focus:ring-brand/50"); // focus ring unchanged
    });

    it("no white-text element in the app uses the plain brand fill", () => {
        const offenders = sourceFiles(join(process.cwd(), "src")).flatMap((file) =>
            readFileSync(file, "utf8").split("\n").map((line, i) => ({ file, line: i + 1, text: line }))
                .filter(({ text }) => text.includes("text-white") && PLAIN_BRAND_FILL.test(text))
                .map(({ file, line }) => `${file.replace(process.cwd() + "/", "")}:${line}`));
        expect(offenders).toEqual([]);
    });
});
