import { useState } from "react";
import ItemCard from "./ItemCard.tsx";
import ItemModal from "./ItemModal.tsx";
import { Category, type CreateItemPayload, MenuItem } from "../../types/menu.ts";
import DeleteCategoryModal from "./DeleteCategoryModal.tsx";

interface Props {
    menuId?: string;
    categories: Category[];
    items: MenuItem[];
    toggleStatus: (itemId: string) => Promise<MenuItem | undefined>;
    deleteItem: (itemId: string) => Promise<void>;
    // ✅ create still returns MenuItem (matches updated ItemModal)
    onCreate: (payload: CreateItemPayload) => Promise<MenuItem>;
    onUpdate: (itemId: string, patch: Partial<MenuItem>) => Promise<MenuItem>;
    // ✅ NEW: required for image upload flow
    onConfirmImage: (itemId: string, objectKey: string) => Promise<MenuItem>;
    // ✅ NEW: required when an image file is selected (create/edit)
    onPresignImage: (itemId: string) => Promise<{
        item: MenuItem;
        upload?: { uploadUrl: string; objectKey: string; expiresInSeconds?: number } | null;
    }>;
}

export default function ItemGrid({
                                     menuId,
                                     categories,
                                     items,
                                     toggleStatus,
                                     deleteItem,
                                     onUpdate,
                                     onCreate,
                                     onConfirmImage,
                                     onPresignImage,
                                 }: Props) {
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<MenuItem | undefined>();

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<MenuItem | undefined>();
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

    const openEdit = (item: MenuItem) => {
        setEditing(item);
        setModalOpen(true);
    };

    const openDelete = (item: MenuItem) => {
        setDeleting(item);
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
            await deleteItem(deleting.id);
            closeDelete();
        } catch (err: any) {
            setDeleteError(err?.response?.data?.message || err?.message || "Failed to delete item");
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:ring-brand/50"
            />

            {filtered.length === 0 ? (
                <p className="text-sm text-gray-500">No items found.</p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filtered.map((item) => (
                        <ItemCard
                            key={item.id}
                            item={item}
                            onEdit={() => openEdit(item)}
                            onToggle={() => toggleStatus(item.id)}
                            onDelete={() => openDelete(item)}
                        />
                    ))}
                </div>
            )}

            <ItemModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                menuId={menuId}
                item={editing}
                categories={categories}
                onCreate={onCreate}
                onUpdate={onUpdate}
                onConfirmImage={onConfirmImage}
                onPresignImage={onPresignImage}
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
