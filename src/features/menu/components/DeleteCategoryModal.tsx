import type {Category} from "../../../types/menu";
import {X} from "lucide-react";

type Props = {
    open: boolean;
    name?: string;
    loading?: boolean;
    error?: string;
    onClose: () => void;
    onConfirm: () => void;
};

export default function DeleteCategoryModal({
                                                open,
                                                name,
                                                loading = false,
                                                error = "",
                                                onClose,
                                                onConfirm,
                                            }: Props) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-lg">
                <div className="flex items-center justify-between border-b px-5 py-4">
                    <h3 className="text-base font-semibold">Delete category</h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 hover:bg-gray-100"
                        aria-label="Close"
                    >
                        <X size={18}/>
                    </button>
                </div>

                <div className="px-5 py-4 space-y-3">
                    <p className="text-sm text-gray-700">
                        Are you sure you want to delete{" "}
                        <span className="font-semibold">{name}</span>?
                    </p>

                    <p className="text-xs text-gray-500">
                        This action cannot be undone.
                    </p>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>

                <div className="flex justify-end gap-2 border-t px-5 py-3">
                    <button
                        onClick={onClose}
                        className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                        disabled={loading}
                    >
                        Cancel
                    </button>

                    <button
                        onClick={onConfirm}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-60"
                        disabled={loading}
                    >
                        {loading ? "Deleting..." : "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}
