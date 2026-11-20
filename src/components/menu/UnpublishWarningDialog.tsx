import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import Button from "../ui/Button";

type Props = { open: boolean; busy: boolean; onKeep: () => void; onUnpublish: () => void };

/** AGF FE-3 (B-6): before unpublishing while publishing needs a plan, the menu couldn't be published again. */
export default function UnpublishWarningDialog({ open, busy, onKeep, onUnpublish }: Props) {
    const keep = () => {
        if (!busy) onKeep();
    };
    return (
        <Modal open={open} onClose={keep} className="max-w-md">
            <div role="dialog" aria-modal="true" aria-label="Unpublish this menu?">
                <ModalHeader title="Unpublish this menu?" onClose={keep} />
                <p className="text-sm text-gray-700">Guests won't see it, and you can't publish it again until you choose a plan.</p>
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="secondary" onClick={keep} disabled={busy} autoFocus>
                        Keep it published
                    </Button>
                    <Button onClick={onUnpublish} disabled={busy}>
                        {busy ? "Unpublishing…" : "Unpublish"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
