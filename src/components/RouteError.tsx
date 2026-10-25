import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import NotFound, { StatusCard } from "./NotFound.tsx";
import { statusPrimaryClass, statusSecondaryClass } from "./statusStyles.ts";

/** AGF-S2-33: root error element. A 404 shows the not-found screen; anything else a generic message, never details. */
export default function RouteError() {
    const error = useRouteError();
    if (isRouteErrorResponse(error) && error.status === 404) return <NotFound context="public" />;

    return (
        <StatusCard
            title="Something went wrong"
            text="Please reload the page. If it keeps happening, try again later."
            actions={
                <>
                    <button type="button" onClick={() => window.location.reload()} className={statusPrimaryClass}>Reload</button>
                    <Link to="/" className={statusSecondaryClass}>Go to the home page</Link>
                </>
            }
        />
    );
}
