import { describe, expect, it } from "vitest";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, imageFileProblem } from "./imagePolicy";
import { isStrongPassword, passwordChecks, PASSWORD_POLICY_MESSAGE } from "./passwordPolicy";

// AGF-S1-17: the frontend applies the same rules as the backend.

const file = (type: string, size = 1024) => ({ type, size }) as File;

describe("image file policy", () => {
    it("accepts JPEG, PNG and WebP up to 8 MB", () => {
        expect(ALLOWED_IMAGE_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
        for (const type of ALLOWED_IMAGE_TYPES) expect(imageFileProblem(file(type))).toBeNull();
        expect(imageFileProblem(file("image/png", MAX_IMAGE_BYTES))).toBeNull();
    });

    it("rejects other types, HEIC and files over 8 MB with clear messages", () => {
        expect(imageFileProblem(file("application/pdf"))).toBe("Unsupported image type. Upload a JPEG, PNG or WebP image.");
        expect(imageFileProblem(file("image/gif"))).toBe("Unsupported image type. Upload a JPEG, PNG or WebP image.");
        expect(imageFileProblem(file("image/heic"))).toBe("HEIC photos aren't supported yet. Please upload a JPEG, PNG or WebP image.");
        expect(imageFileProblem(file("image/jpeg", MAX_IMAGE_BYTES + 1))).toBe("Image is too large. The maximum size is 8 MB.");
    });
});

describe("password policy", () => {
    it("requires 8-72 characters with upper, lower, number and symbol", () => {
        expect(isStrongPassword("Str0ng!Pass")).toBe(true);
        for (const weak of ["abcdef", "abcdefgh", "Abcdefgh", "Abcdefg1", "ABCDEFG1!", "abcdefg1!", "Ab1!", "Aa1!" + "x".repeat(80)]) {
            expect(isStrongPassword(weak), weak).toBe(false);
        }
        expect(passwordChecks("abc")).toMatchObject({ minLength: false, uppercase: false, number: false, symbol: false, lowercase: true });
        expect(PASSWORD_POLICY_MESSAGE).toBe(
            "Password must be 8-72 characters and include an uppercase letter, a lowercase letter, a number and a symbol");
    });
});
