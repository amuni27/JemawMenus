import { useEffect, useState } from "react";
import planApi from "../api/planApi";

// AGF FE-3 (BE-5b): what the plan view says about publishing. `publishAllowed` is present only while the publish gate is on
// for the restaurant's market; undefined (gate off, not gated, plans hidden or the read failed) means "behave as before".
// Only hints and warnings use it: the server's answer to a publish is always the authority (F-1).
export type PublishPermission = { publishAllowed?: boolean; plansVisible?: boolean };

export function usePublishPermission(): PublishPermission {
    const [permission, setPermission] = useState<PublishPermission>({});
    useEffect(() => {
        let alive = true;
        planApi.get().then(
            (res) => alive && setPermission({
                publishAllowed: typeof res.data.publishAllowed === "boolean" ? res.data.publishAllowed : undefined,
                plansVisible: res.data.visible,
            }),
            () => alive && setPermission({}));
        return () => { alive = false; };
    }, []);
    return permission;
}
