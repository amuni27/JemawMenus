import React from "react";

type ToastProps = {
    message: string;
    show: boolean;
};

export function Toast({ message, show }: ToastProps) {
    if (!show) return null;

    return (
        <div className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-full bg-black/90 px-4 py-2 text-white shadow-xl animate-toast">
                <svg
                    className="h-5 w-5 text-emerald-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                >
                    <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8.25 8.25a1 1 0 01-1.414 0l-3.75-3.75a1 1 0 111.414-1.414L7.5 12.586l7.543-7.543a1 1 0 011.414 0z"
                        clipRule="evenodd"
                    />
                </svg>

                <span className="text-sm font-semibold">{message}</span>
            </div>
        </div>
    );
}
