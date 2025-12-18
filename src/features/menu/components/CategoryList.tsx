import {useState} from "react";
import CategoryModal from "./CategoryModal";
import type {Category} from "../../../types/menu";
import { Pencil, Trash2 } from "lucide-react";
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
}

export default function CategoryList({ menuId, categories, loading, error, onCreate, onUpdate,onDelete }: Props) {

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

            {!loading && !error && categories.length === 0 ? (
                <p className="text-sm text-gray-500">No categories yet.</p>
            ) : (
                <ul className="space-y-1">
                    {categories.map((c) => (
                        <li
                            key={c.id}
                            className="flex items-center justify-between rounded border px-3 py-1 text-sm"
                        >
                            <span>{c.name}</span>
                            <div>
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
