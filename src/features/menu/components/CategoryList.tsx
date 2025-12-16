import { useState } from "react";
import { useCategories } from "../hooks/useCategories";
import CategoryModal from "./CategoryModal";
import type { Category } from "../../../types/menu";

interface Props {
    menuId?: string;
}

export default function CategoryList({ menuId }: Props) {
    const { categories, loading, error } = useCategories(menuId);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Category | undefined>();

    const openEdit = (cat: Category) => {
        setEditing(cat);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditing(undefined); // ✅ reset
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
                            <button
                                onClick={() => openEdit(c)}
                                className="rounded bg-gray-50 px-2 py-0.5 text-xs hover:bg-gray-100"
                            >
                                Rename
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <CategoryModal
                open={modalOpen}
                onClose={closeModal}
                menuId={menuId}
                category={editing}
            />
        </div>
    );
}
