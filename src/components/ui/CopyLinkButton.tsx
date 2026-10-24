import { useToast } from "./ToastContext";

// Copies a link to the clipboard with success / failure feedback (AGF-S2-10)
export default function CopyLinkButton({ url, successMessage = "Link copied" }: { url: string; successMessage?: string }) {
    const toast = useToast();

    const copy = async () => {
        try {
            if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
            await navigator.clipboard.writeText(url);
            toast(successMessage);
        } catch {
            toast("Couldn't copy the link. Select it and copy it manually.");
        }
    };

    return (
        <button
            type="button"
            onClick={copy}
            className="shrink-0 whitespace-nowrap rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
            Copy link
        </button>
    );
}
