import {useState} from "react";
import CategoryModal from "./CategoryModal.tsx";
import type {Category} from "../../types/menu.ts";
import { ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { errorMessage } from "../../utils/errorMessage";
import DeleteCategoryModal from "./DeleteCategoryModal.tsx";

interface Props {
    menuId?: string;
    // state
    categories: Category[];
    loading: boolean;
    error?: string;

    // actions
    onCreate: (name: string) => Promise<Category>;
    onUpdate: (categoryId: string, name: string) => Promise<Category>;
    onDelete: (categoryId: string) => Promise<void>;
    onToggleActive?: (categoryId: string, active: boolean) => Promise<Category>;
    /** AGF-S2-07: move a category one place up (-1) or down (+1) */
    onMove?: (categoryId: string, direction: -1 | 1) => Promise<void>;
}

export default function CategoryList({ menuId, categories, loading, error, onCreate, onUpdate, onDelete, onToggleActive, onMove }: Props) {

    // AGF-S2-07: one move at a time; a failed save restores the order and explains why
    const [moving, setMoving] = useState(false);
    const [moveError, setMoveError] = useState("");

    const move = async (categoryId: string, direction: -1 | 1) => {
        if (!onMove || moving) return;
        setMoving(true);
        setMoveError("");
        try {
            await onMove(categoryId, direction);
        } catch (err) {
            setMoveError(`Couldn't save the new order: ${errorMessage(err, "Please try again.")}`);
        } finally {
            setMoving(false);
        }
    };

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Category | undefined>();


    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<Category | undefined>();
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState("");


    const openEdit = (cat: Category) => {
        setEditing(cat);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditing(undefined); // ✅ reset
    };

    const openDelete = (cat: Category) => {
        setDeleting(cat);
        setDeleteError("");
        setDeleteOpen(true);
    };

    const closeDelete = () => {
        setDeleteOpen(false);
        setDeleting(undefined);
        setDeleteError("");
    };

    const confirmDelete = async () => {
        if (!deleting?.id) return;

        try {
            setDeleteLoading(true);
            setDeleteError("");
            await onDelete(deleting.id);
            closeDelete();
        } catch (err: any) {
            setDeleteError(err?.response?.data?.message || err?.message || "Failed to delete category");
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="mb-2 text-lg font-semibold">Categories</h2>

            {loading && <p className="text-sm text-gray-500">Loading...</p>}
            {!loading && error && <p className="text-sm text-red-600">{error}</p>}
            {moveError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{moveError}</p>}

            {!loading && !error && categories.length === 0 ? (
                <p className="text-sm text-gray-500">No categories yet.</p>
            ) : (
                <ul className="space-y-1" aria-label="Categories">
                    {categories.map((c, index) => (
                        <li
                            key={c.id}
                            data-name={c.name}
                            className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-sm"
                        >
                            {onMove && (
                                <span className="flex shrink-0 flex-col">
                                    <button
                                        type="button"
                                        onClick={() => move(c.id, -1)}
                                        disabled={moving || index === 0}
                                        aria-label={`Move ${c.name} up`}
                                        className="flex h-7 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                                    >
                                        <ChevronUp size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(c.id, 1)}
                                        disabled={moving || index === categories.length - 1}
                                        aria-label={`Move ${c.name} down`}
                                        className="flex h-7 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                                    >
                                        <ChevronDown size={16} />
                                    </button>
                                </span>
                            )}
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                                {c.name}
                                {(c.active ?? c.isActive ?? true) === false && (
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Hidden</span>
                                )}
                            </span>
                            <div className="shrink-0">
                                {onToggleActive && (() => {
                                    const visible = (c.active ?? c.isActive ?? true) !== false;
                                    return (
                                        <button
                                            type="button"
                                            onClick={() => onToggleActive(c.id, !visible)}
                                            aria-label={visible ? `Hide ${c.name} from guests` : `Show ${c.name} to guests`}
                                            className="rounded bg-gray-50 px-2 py-0.5 text-xs hover:bg-gray-100"
                                        >
                                            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    );
                                })()}
                                <button
                                    onClick={() => openEdit(c)}
                                    className="rounded bg-gray-50 px-2 py-0.5 text-xs hover:bg-gray-100"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={() => openDelete(c)}
                                    className="rounded bg-gray-50 px-2 py-0.5 text-xs hover:bg-gray-100"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </li>

                    ))}
                </ul>

            )}

            <CategoryModal
                open={modalOpen}
                onClose={closeModal}
                menuId={menuId}
                category={editing}
                onCreate={onCreate}
                onUpdate={onUpdate}
            />

            <DeleteCategoryModal
                open={deleteOpen}
                name={deleting?.name}
                loading={deleteLoading}
                error={deleteError}
                onClose={closeDelete}
                onConfirm={confirmDelete}
            />
        </div>
    );
}
