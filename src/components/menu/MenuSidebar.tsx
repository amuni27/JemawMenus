import React, { useEffect, useRef, useState } from "react";

type Props = {
    menus: any[];
    activeMenuId: string | null;
    onSelectMenu: (menuId: string) => void;
    loading?: boolean;
};

export function MenuSidebar({ menus, activeMenuId, onSelectMenu, loading }: Props) {
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const [canScroll, setCanScroll] = useState(false);
    const [atStart, setAtStart] = useState(true);
    const [atEnd, setAtEnd] = useState(false);

    useEffect(() => {
        const el = scrollerRef.current;
        if (!el) return;

        const update = () => {
            const can = el.scrollWidth > el.clientWidth + 1;
            setCanScroll(can);

            setAtStart(el.scrollLeft <= 0);
            setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
        };

        update();

        el.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);

        return () => {
            el.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
        };
    }, [menus?.length]);

    return (
        <div className="h-full">
            <div className="relative">
                {/* Left fade (only when scrollable and not at start) */}
                {canScroll && !atStart && (
                    <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-white to-transparent" />
                )}

                {/* Right fade (only when scrollable and not at end) */}
                {canScroll && !atEnd && (
                    <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-white to-transparent" />
                )}

                <div
                    ref={scrollerRef}
                    className="flex gap-3 overflow-x-auto overflow-y-hidden whitespace-nowrap p-2 scroll-smooth snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {menus?.map((m: any) => {
                        const active = m.id === activeMenuId;

                        return (
                            <button
                                key={m.id}
                                onClick={() => onSelectMenu(m.id)}
                                className={`shrink-0 snap-start rounded-xl px-4 py-2 text-left transition ${
                                    active
                                        ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                                        : "hover:bg-gray-50"
                                }`}
                            >
                                <div className="font-semibold">{m.name}</div>
                                {m.description ? (
                                    <div className="mt-1 text-xs text-gray-500">{m.description}</div>
                                ) : null}
                            </button>
                        );
                    })}

                    {!menus?.length && !loading ? (
                        <div className="text-sm text-gray-500">No menus found.</div>
                    ) : null}
                </div>

                {/* Small hint (only when scrollable) */}
                {canScroll && !atEnd && (
                    <div className="px-2 pb-2 text-right text-xs text-gray-400">
                        Scroll → for more menus
                    </div>
                )}
            </div>
        </div>
    );
}
