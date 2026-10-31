import type { ReactNode } from "react";
import { GuestClockContext } from "../../utils/specials";

// AGF-S2-25 (checkpoint B): shares the guest page's clock so specials end on time without a reload.
export function GuestClockProvider({ now, children }: { now: Date; children: ReactNode }) {
    return <GuestClockContext.Provider value={now}>{children}</GuestClockContext.Provider>;
}
