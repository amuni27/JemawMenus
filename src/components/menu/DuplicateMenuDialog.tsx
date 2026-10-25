import { FormEvent, useState } from "react";
import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import Button from "../ui/Button";
import menuApi from "../../api/menuApi";
import { Menu, MenuDuplicateResult } from "../../types/menu";
import { useFieldErrors } from "../../utils/fieldErrors";

const MAX_NAME = 255;
const SUFFIX = " (copy)";

/** "{name} (copy)", shortened so it fits the 255-character limit (same rule as the backend default) */
function copyName(name: string): string {
    return name.slice(0, MAX_NAME - SUFFIX.length) + SUFFIX;
}

type Props = {
    menu: Menu;
    onClose: () => void;
    onDuplicated: (result: MenuDuplicateResult) => void;
};

/** AGF-S2-18: confirmation with an editable name before copying a menu into a new, unpublished menu */
export default function DuplicateMenuDialog({ menu, onClose, onDuplicated }: Props) {
    const [name, setName] = useState(() => copyName(menu.name));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [blank, setBlank] = useState(false);
    const serverErrors = useFieldErrors(); // AGF-S2-11

    const close = () => {
        if (!busy) onClose();
    };

    const submit = async (e?: FormEvent) => {
        e?.preventDefault();
        if (busy) return;
        const trimmed = name.trim();
        if (!trimmed) {
            setBlank(true);
            return;
        }
        setBusy(true);
        setError("");
        serverErrors.clear();
        try {
            const response = await menuApi.duplicateMenu(menu.id, trimmed);
            onDuplicated(response.data);
        } catch (err) {
            setError(serverErrors.apply(err, { name: trimmed }, "Couldn't duplicate the menu. Please try again.") ?? "");
            setBusy(false);
        }
    };

    const nameError = (blank && !name.trim() ? "Enter a name for the new menu." : undefined)
        ?? serverErrors.errorFor("name", name.trim());

    return (
        <Modal open onClose={close} className="max-w-md">
            <div role="dialog" aria-modal="true" aria-label="Duplicate menu">
                <ModalHeader title="Duplicate menu" onClose={close} />
                <form onSubmit={submit} noValidate>
                    <p className="text-sm text-gray-700">
                        Copies all categories and items of <strong>{menu.name}</strong> into a new, unpublished menu.
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Sold-out items become available. Hidden items stay hidden.</p>

                    <label htmlFor="duplicate-menu-name" className="mt-4 mb-1 block text-sm font-medium text-gray-700">
                        Name of the new menu
                    </label>
                    <input
                        id="duplicate-menu-name"
                        autoFocus
                        value={name}
                        maxLength={MAX_NAME}
                        disabled={busy}
                        onChange={(e) => setName(e.target.value)}
                        aria-invalid={nameError ? true : undefined}
                        aria-describedby={nameError ? "duplicate-menu-name-error" : undefined}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/50"
                    />
                    {nameError && (
                        <p id="duplicate-menu-name-error" className="mt-1 text-xs text-red-600">
                            {nameError}
                        </p>
                    )}

                    {error && (
                        <p role="alert" className="mt-3 text-sm text-red-600">
                            {error}
                        </p>
                    )}

                    <div className="mt-6 flex justify-end gap-2">
                        <Button type="button" variant="secondary" onClick={close} disabled={busy}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={busy}>
                            {busy ? "Duplicating…" : "Duplicate"}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}
