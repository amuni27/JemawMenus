export function XIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path
        d="M18 6 6 18M6 6l12 12"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
        />
        </svg>
);
}

export function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path
        d="M4 7h16"
    strokeWidth="2"
    strokeLinecap="round"
    />
    <path
        d="M10 11v6M14 11v6"
    strokeWidth="2"
    strokeLinecap="round"
    />
    <path
        d="M6 7l1 14h10l1-14"
    strokeWidth="2"
    strokeLinejoin="round"
    />
    <path
        d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
    strokeWidth="2"
    strokeLinejoin="round"
        />
        </svg>
);
}

export function BroomIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path
        d="M3 20h6"
    strokeWidth="2"
    strokeLinecap="round"
    />
    <path
        d="M7 20c0-4 3-7 7-7h2"
    strokeWidth="2"
    strokeLinecap="round"
    />
    <path
        d="M13 13l7-7"
    strokeWidth="2"
    strokeLinecap="round"
    />
    <path
        d="M15 6l3 3"
    strokeWidth="2"
    strokeLinecap="round"
        />
        </svg>
);
}

export function ClearIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            {/* Handle */}
            <path d="M14 3l7 7" />
            <path d="M12.5 4.5l7 7" />

            {/* Connector */}
            <path d="M9.5 7.5l7 7" />

            {/* Broom head */}
            <path d="M4 20h7" />
            <path d="M6 20c0-4 3.5-7 7.5-7h2.5" />
        </svg>
    );
}

