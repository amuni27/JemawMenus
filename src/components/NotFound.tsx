import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/context/AuthContext.tsx";
import { statusPrimaryClass, statusSecondaryClass } from "./statusStyles.ts";

/**
 * AGF-S2-33: Agafari-branded status screens. `StatusCard` is the shared layout (accessible heading focused on load,
 * no technical detail); `NotFound` picks the message and the way forward for the context.
 */
export function StatusCard({ caption, title, text, actions, embedded = false, headingLevel = 1 }: {
    caption?: string;
    /** 2 inside the admin layout, whose sidebar already has the page's h1 */
    headingLevel?: 1 | 2;
    title: string;
    text: string;
    actions: ReactNode;
    /** Inside an existing page (guest menu, admin layout): no full-screen wrapper */
    embedded?: boolean;
}) {
    const headingRef = useRef<HTMLHeadingElement | null>(null);
    const Heading = headingLevel === 2 ? "h2" : "h1";

    useEffect(() => {
        headingRef.current?.focus();
    }, []);

    const card = (
        <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg sm:p-8">
            <p className="text-sm font-bold tracking-wide text-rose-600">AGAFARI MENU</p>
            {caption && <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">{caption}</p>}
            <Heading ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-bold text-gray-900 focus:outline-none">
                {title}
            </Heading>
            <p className="mt-3 text-sm text-gray-600">{text}</p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">{actions}</div>
        </div>
    );

    if (embedded) return <div className="px-4 py-12">{card}</div>;
    return <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">{card}</main>;
}

const primary = statusPrimaryClass;
const secondary = statusSecondaryClass;

function usePageTitle(title: string) {
    useEffect(() => {
        const previous = document.title;
        document.title = title;
        return () => {
            document.title = previous;
        };
    }, [title]);
}

/** The owner's dashboard comes from the signed-in session, never from the URL (D-NF-3) */
function OwnerActions() {
    const { business } = useAuth();
    const home = business?.id ? `/${business.id}/admin` : "/auth/login";
    return (
        <>
            <Link to={home} className={primary}>Go to your dashboard</Link>
            {business?.id && <Link to={`${home}/menus`} className={secondary}>Menus</Link>}
        </>
    );
}

type Props =
    | { context: "public" | "restaurant"; businessId?: never; fullPage?: never }
    | { context: "owner"; businessId?: never; /** Outside the admin layout (e.g. the preview page): own page and h1 */ fullPage?: boolean }
    | { context: "item"; businessId: string; fullPage?: never };

export default function NotFound(props: Props) {
    usePageTitle("Page not found · Agafari");
    const caption = "Error 404";

    switch (props.context) {
        case "restaurant":
            return (
                <StatusCard
                    caption={caption}
                    title="We can't find this restaurant's menu"
                    text="Check the QR code or link, or ask the staff."
                    actions={<Link to="/" className={primary}>Go to the Agafari home page</Link>}
                />
            );
        case "item":
            return (
                <StatusCard
                    embedded
                    caption={caption}
                    title="This dish isn't on the menu right now"
                    text="It may have been removed or hidden by the restaurant."
                    actions={<Link to={`/${props.businessId}/menu`} className={primary}>Back to the menu</Link>}
                />
            );
        case "owner":
            return (
                <StatusCard
                    embedded={!props.fullPage}
                    headingLevel={props.fullPage ? 1 : 2}
                    caption={caption}
                    title="We can't find that page"
                    text="It may have been deleted, or the link is wrong."
                    actions={<OwnerActions />}
                />
            );
        default:
            return (
                <StatusCard
                    caption={caption}
                    title="We can't find that page"
                    text="The link may be broken or the page may have moved."
                    actions={<Link to="/" className={primary}>Go to the home page</Link>}
                />
            );
    }
}

