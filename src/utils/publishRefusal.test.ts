import { describe, expect, it } from "vitest";
import { publishRefusal } from "./publishRefusal";

// AGF FE-3 (register §54): a publish refusal is classified by the backend's code only (BE-4: 409 PLAN_REQUIRED_TO_PUBLISH;
// AGF-S2-22: 403 EMAIL_NOT_VERIFIED, checked first), never by message text.

const fail = (status: number, code?: string, message = "Some message") => ({ response: { status, data: { code, message } } });

describe("publishRefusal", () => {
    it("recognises a plan refusal", () => {
        expect(publishRefusal(fail(409, "PLAN_REQUIRED_TO_PUBLISH"))).toBe("plan");
    });

    it("recognises an email verification refusal", () => {
        expect(publishRefusal(fail(403, "EMAIL_NOT_VERIFIED"))).toBe("verification");
    });

    it.each([
        ["a 409 without the code", fail(409, "SUBSCRIPTION_EXISTS", "Choose a plan to publish your menu.")],
        ["a 403 for something else", fail(403, "ACCOUNT_INACTIVE", "Verify your email to publish menus.")],
        ["the plan code on another status", fail(400, "PLAN_REQUIRED_TO_PUBLISH")],
        ["a validation error", fail(400)],
        ["a network failure", { code: "ERR_NETWORK", message: "Network Error" }],
        ["nothing", undefined],
    ])("ignores %s", (_label, err) => {
        expect(publishRefusal(err)).toBeNull();
    });
});
