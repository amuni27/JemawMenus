import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../app/context/AuthContext";

// AGF F4: the frame of the checkout return and cancel pages, always with a way back to Subscription & Plans
export default function CheckoutShell({ title, busy, children }: { title: string; busy?: boolean; children?: ReactNode }) {
    const { business } = useAuth();
    const plansHref = business?.id ? `/${business.id}/admin/plans` : "/";
    return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
            <section aria-labelledby="checkout-title" className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div role="status" aria-live="polite" aria-busy={busy ? true : undefined}>
                    <h1 id="checkout-title" className="text-lg font-semibold text-gray-900">{title}</h1>
                    {children}
                </div>
                <Link to={plansHref} className="mt-5 inline-block font-semibold text-rose-700 underline hover:text-rose-800">
                    Go to Subscription &amp; Plans
                </Link>
            </section>
        </main>
    );
}
