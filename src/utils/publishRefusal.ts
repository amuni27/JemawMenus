// AGF FE-3 (register §52–§54): why the backend refused to publish a menu, by its code only (never the message text).
// BE-4: 409 PLAN_REQUIRED_TO_PUBLISH; AGF-S2-22: 403 EMAIL_NOT_VERIFIED (checked first by the backend).
export type PublishRefusal = "plan" | "verification";

type ApiFailure = { response?: { status?: number; data?: { code?: unknown } } };

export function publishRefusal(err: unknown): PublishRefusal | null {
    const response = (err as ApiFailure | null)?.response;
    const code = response?.data?.code;
    if (response?.status === 409 && code === "PLAN_REQUIRED_TO_PUBLISH") return "plan";
    if (response?.status === 403 && code === "EMAIL_NOT_VERIFIED") return "verification";
    return null;
}
