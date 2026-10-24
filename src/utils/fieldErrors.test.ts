// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFieldErrors } from "./fieldErrors";

// AGF-S2-11: backend `fieldErrors` (S1-10 contract) become per-field messages.

const validation400 = (fieldErrors: { field: string; message: string }[], message = "Validation failed") => ({
    response: { status: 400, data: { status: 400, error: "Bad Request", message, fieldErrors } },
});

describe("useFieldErrors", () => {
    it("maps known fields (including nested names) and shows no generic banner", () => {
        const { result } = renderHook(() => useFieldErrors());
        let banner: string | null = "unset";
        act(() => {
            banner = result.current.apply(
                validation400([
                    { field: "name", message: "size must be between 1 and 255" },
                    { field: "ingredients[0]", message: "must not be blank" },
                    { field: "name", message: "second message ignored" },
                ]),
                { name: "", ingredients: "x" },
                "Failed to save",
            );
        });
        expect(banner).toBeNull();
        expect(result.current.errorFor("name", "")).toBe("size must be between 1 and 255");
        expect(result.current.errorFor("ingredients", "x")).toBe("must not be blank");
        expect(result.current.errorFor("price", "1")).toBeUndefined();
    });

    it("puts unknown fields in the banner instead of dropping them", () => {
        const { result } = renderHook(() => useFieldErrors());
        let banner: string | null = null;
        act(() => {
            banner = result.current.apply(validation400([
                { field: "name", message: "is required" },
                { field: "businessHours[2].startTime", message: "Invalid time format" },
            ]), { name: "" }, "Failed");
        });
        expect(banner).toBe("Invalid time format");
        expect(result.current.errorFor("name", "")).toBe("is required");
    });

    it("keeps the server message when there are no field errors", () => {
        const { result } = renderHook(() => useFieldErrors());
        let banner: string | null = null;
        act(() => {
            banner = result.current.apply({ response: { status: 400, data: { message: "Unsupported currency. Use ETB or USD." } } }, {}, "Failed");
        });
        expect(banner).toBe("Unsupported currency. Use ETB or USD.");
        act(() => {
            banner = result.current.apply(new Error("boom"), {}, "Failed to save");
        });
        expect(banner).toBe("Failed to save");
    });

    it("hides a field error once the user changes that field, and clears all on demand", () => {
        const { result } = renderHook(() => useFieldErrors());
        act(() => {
            result.current.apply(validation400([{ field: "price", message: "must be greater than or equal to 0.00" }]), { price: "-1" }, "Failed");
        });
        expect(result.current.errorFor("price", "-1")).toBe("must be greater than or equal to 0.00");
        expect(result.current.errorFor("price", "5")).toBeUndefined(); // corrected
        expect(result.current.errorFor("price", -1)).toBe("must be greater than or equal to 0.00"); // same value, other type

        act(() => result.current.clear());
        expect(result.current.errorFor("price", "-1")).toBeUndefined();
    });
});
