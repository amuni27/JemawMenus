import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { errorMessage } from "../../utils/errorMessage";
import ItemCard from "./ItemCard.tsx";
import ItemModal from "./ItemModal.tsx";
import { Category, type CreateItemPayload, MenuItem } from "../../types/menu.ts";
import DeleteCategoryModal from "./DeleteCategoryModal.tsx";

interface Props {
    /** The restaurant's currency (AGF-S2-02) */
    currency?: string;
    menuId?: string;
    categories: Category[];
    items: MenuItem[];
    toggleStatus: (itemId: string) => Promise<MenuItem | undefined>;
    toggleSoldOut?: (itemId: string) => Promise<MenuItem | undefined>;
    deleteItem: (itemId: string) => Promise<void>;
    /** AGF-S2-08: move an item one place earlier (-1) or later (+1) within its category */
    onMoveItem?: (itemId: string, direction: -1 | 1) => Promise<void>;
    // ✅ create still returns MenuItem (matches updated ItemModal)
    onCreate: (payload: CreateItemPayload) => Promise<MenuItem>;
    onUpdate: (itemId: string, patch: Partial<MenuItem>) => Promise<MenuItem>;
    // ✅ NEW: required for image upload flow
    onConfirmImage: (itemId: string, objectKey: string) => Promise<MenuItem>;
    // ✅ NEW: required when an image file is selected (create/edit)
    onPresignImage: (itemId: string, contentType: string) => Promise<{
        item: MenuItem;
        upload?: { uploadUrl: string; objectKey: string; expiresInSeconds?: number } | null;
    }>;
}

export default function ItemGrid({
                                     menuId,
                                     categories,
                                     items,
                                     toggleStatus,
                                     toggleSoldOut,
                                     deleteItem,
                                     onMoveItem,
                                     onUpdate,
                                     onCreate,
                                     onConfirmImage,
                                     onPresignImage,
                                     currency,
                                 }: Props) {
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<MenuItem | undefined>();

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState<MenuItem | undefined>();
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    // AGF-S2-08: one category at a time, by saved position, so its order can be changed
    const [categoryId, setCategoryId] = useState("");
    const [moving, setMoving] = useState(false);
    const [moveError, setMoveError] = useState("");
    const sortedCategories = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const inCategory = categoryId
        ? items.filter((i) => i.categoryId === categoryId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        : items;
    const filtered = inCategory.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    const canReorder = Boolean(onMoveItem && categoryId && !search.trim());

    const move = async (itemId: string, direction: -1 | 1) => {
        if (!onMoveItem || moving) return;
        setMoving(true);
        setMoveError("");
        try {
            await onMoveItem(itemId, direction);
        } catch (err) {
            setMoveError(`Couldn't save the new order: ${errorMessage(err, "Please try again.")}`);
        } finally {
            setMoving(false);
        }
    };

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
            <div className="flex flex-col gap-2 sm:flex-row">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search items"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:ring-brand/50"
                />
                <label className="sr-only" htmlFor="items-category-filter">Category</label>
                <select
                    id="items-category-filter"
                    value={categoryId}
                    onChange={(e) => { setCategoryId(e.target.value); setMoveError(""); }}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm sm:w-56"
                >
                    <option value="">All categories</option>
                    {sortedCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {onMoveItem && (
                <p className="text-xs text-gray-500">
                    {!categoryId
                        ? "Choose a category to change the order of its items."
                        : search.trim()
                            ? "Clear the search to change the order."
                            : "Use the arrows to move an item earlier or later. Guests see the same order."}
                </p>
            )}
            {moving && <p role="status" className="text-xs text-gray-500">Saving order…</p>}
            {moveError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{moveError}</p>}

            {filtered.length === 0 ? (
                <p className="text-sm text-gray-500">No items found.</p>
            ) : (
                <div role="list" aria-label="Items" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filtered.map((item, index) => (
                        <div role="listitem" key={item.id} data-name={item.name} className="flex flex-col gap-2">
                            <ItemCard
                                currency={currency}
                                item={item}
                                onEdit={() => openEdit(item)}
                                onToggle={() => toggleStatus(item.id)}
                                onSoldOutToggle={toggleSoldOut ? () => toggleSoldOut(item.id) : undefined}
                                onDelete={() => openDelete(item)}
                            />
                            {canReorder && (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => move(item.id, -1)}
                                        disabled={moving || index === 0}
                                        aria-label={`Move ${item.name} earlier`}
                                        className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                                    >
                                        <ChevronLeft size={16} /> Earlier
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(item.id, 1)}
                                        disabled={moving || index === filtered.length - 1}
                                        aria-label={`Move ${item.name} later`}
                                        className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                                    >
                                        Later <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
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
                currency={currency}
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
