import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import Button from "../ui/Button";

type Props = {
    open: boolean;
    count: number;
    busy: boolean;
    error: string;
    onClose: () => void;
    onConfirm: () => void;
};

/** AGF-S2-19: confirmation before marking every sold-out item of the menu as available */
export default function MarkAllAvailableDialog({ open, count, busy, error, onClose, onConfirm }: Props) {
    const close = () => {
        if (!busy) onClose();
    };

    return (
        <Modal open={open} onClose={close} className="max-w-md">
            <div role="dialog" aria-modal="true" aria-label="Mark all available">
                <ModalHeader title="Mark all available" onClose={close} />
                <p className="text-sm text-gray-700">
                    Mark {count} sold-out item{count === 1 ? "" : "s"} as available?
                </p>
                <p className="mt-1 text-xs text-gray-500">Hidden items stay hidden. Only this menu changes.</p>
                {error && (
                    <p role="alert" className="mt-3 text-sm text-red-600">
                        {error}
                    </p>
                )}
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="secondary" onClick={close} disabled={busy}>
                        Cancel
                    </Button>
                    <Button onClick={onConfirm} disabled={busy}>
                        {busy ? "Marking…" : "Mark available"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
