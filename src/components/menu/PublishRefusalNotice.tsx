import { useState } from "react";
import { Link } from "react-router-dom";
import { emailVerificationApi } from "../../api/emailVerificationApi";
import { errorMessage } from "../../utils/errorMessage";
import type { PublishRefusal } from "../../utils/publishRefusal";
import type { ReactNode } from "react";

export const PLAN_REFUSAL_FALLBACK = "Choose a plan to publish your menu. You can keep editing it meanwhile.";
export const VERIFICATION_REFUSAL_TEXT = "Verify your email to publish menus.";

type Props = {
    kind: PublishRefusal;
    message?: string;          // the server's explanation (plan refusals)
    businessId?: string;
    plansVisible?: boolean;    // false: plans can't be chosen in the app (F-3)
    children?: ReactNode;      // e.g. the "save without publishing" action
};

/** AGF FE-3: a publish refusal, kept distinct by kind: a plan (with "Choose a plan") or email verification (with resend). */
export default function PublishRefusalNotice({ kind, message, businessId, plansVisible, children }: Props) {
    const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | string>("idle");

    if (kind === "verification") {
        const resend = async () => {
            setResendState("sending");
            try {
                await emailVerificationApi.resend();
                setResendState("sent");
            } catch (err) {
                setResendState(errorMessage(err, "Couldn't send the email. Please try again."));
            }
        };
        return (
            <section aria-label="Publishing refused" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p role="alert">{VERIFICATION_REFUSAL_TEXT}</p>
                <p className="mt-1">
                    <button type="button" className="font-semibold underline" onClick={resend} disabled={resendState === "sending"}>
                        Resend verification email
                    </button>
                    {resendState === "sent" && <span className="ml-2">Verification email sent.</span>}
                    {resendState !== "idle" && resendState !== "sending" && resendState !== "sent" && <span className="ml-2">{resendState}</span>}
                </p>
                {children}
            </section>
        );
    }

    return (
        <section aria-label="Publishing refused" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p role="alert">{message || PLAN_REFUSAL_FALLBACK}</p>
            <p className="mt-1">
                {plansVisible === false || !businessId
                    ? "Contact the Agafari team to choose a plan."
                    : <Link to={`/${businessId}/admin/plans`} className="font-semibold underline">Choose a plan</Link>}
            </p>
            {children}
        </section>
    );
}

/** AGF FE-3: the pre-click hint while publishing needs a plan (publishAllowed false). */
export function PublishNeedsPlanHint({ businessId, plansVisible }: { businessId?: string; plansVisible?: boolean }) {
    return (
        <p className="mt-1 text-sm text-amber-900">
            Publishing needs a plan.{" "}
            {plansVisible === false || !businessId
                ? "Contact the Agafari team to choose a plan."
                : <Link to={`/${businessId}/admin/plans`} className="font-semibold underline">Choose a plan</Link>}
        </p>
    );
}
