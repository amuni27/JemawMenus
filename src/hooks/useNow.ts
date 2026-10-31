import { useEffect, useState } from "react";

/** The current time, refreshed every `intervalMs` while the page stays open (AGF-S2-03; shared since AGF-S2-25). */
export function useNow(intervalMs = 60_000): Date {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}
