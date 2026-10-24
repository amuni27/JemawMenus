import { useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
    DndContext,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
    type Announcements,
    type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
    /** AGF-S2-08A: save a new order for one category's items (drag and drop) */
    onReorderItems?: (categoryId: string, orderedIds: string[]) => Promise<void>;
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

// AGF-S2-08A: the whole card is dragged, but never from its own controls (Hide/Show, Edit, Delete, stock), so
// those keep working and a press on them cannot start a drag.
const isControl = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest("button, a, input, select, textarea, label"));

class CardMouseSensor extends MouseSensor {
    static activators = MouseSensor.activators.map((a) => ({
        ...a,
        handler: (...args: Parameters<typeof a.handler>) => !isControl(args[0].nativeEvent.target) && a.handler(...args),
    }));
}

class CardTouchSensor extends TouchSensor {
    static activators = TouchSensor.activators.map((a) => ({
        ...a,
        handler: (...args: Parameters<typeof a.handler>) => !isControl(args[0].nativeEvent.target) && a.handler(...args),
    }));
}

// Space / Enter / arrows only pick a card up when the card itself has focus, not one of its buttons
class CardKeyboardSensor extends KeyboardSensor {
    static activators = KeyboardSensor.activators.map((a) => ({
        ...a,
        handler: (...args: Parameters<typeof a.handler>) => args[0].target === args[0].currentTarget && a.handler(...args),
    }));
}

const ITEM_DRAG_INSTRUCTIONS =
    "To reorder an item, focus the item card and press Space to pick it up. " +
    "Use the arrow keys to move it, then press Space to drop it, or Escape to cancel.";

/** AGF-S2-08A: an item card that can be dragged by pressing anywhere on it (no grip icon) */
function SortableItemCard({ id, name, index, enabled, disabled, children }: {
    id: string;
    name: string;
    index: number;
    enabled: boolean;
    disabled: boolean;
    children: ReactNode;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled: !enabled || disabled,
        attributes: { role: "group", roleDescription: "sortable item" },
    });

    return (
        <div
            role="listitem"
            ref={setNodeRef}
            data-name={name}
            data-item-index={index}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={isDragging ? "relative z-10" : undefined}
        >
            {enabled ? (
                <div
                    {...attributes}
                    {...listeners}
                    aria-label={`Reorder ${name}`}
                    className={`touch-manipulation select-none rounded-2xl outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-brand [-webkit-touch-callout:none] [&_img]:pointer-events-none ${
                        isDragging
                            ? "cursor-grabbing scale-[1.02] shadow-2xl ring-2 ring-brand/30"
                            : disabled ? "cursor-progress" : "cursor-grab"
                    }`}
                >
                    {children}
                </div>
            ) : (
                children
            )}
        </div>
    );
}

export default function ItemGrid({
                                     menuId,
                                     categories,
                                     items,
                                     toggleStatus,
                                     toggleSoldOut,
                                     deleteItem,
                                     onReorderItems,
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

    // AGF-S2-09: the dashboard's "N items sold out" link opens this view with ?stock=sold-out
    const [searchParams, setSearchParams] = useSearchParams();
    const soldOutOnly = searchParams.get("stock") === "sold-out";
    const showAllItems = () => setSearchParams((p) => { p.delete("stock"); return p; }, { replace: true });

    const inCategory = categoryId
        ? items.filter((i) => i.categoryId === categoryId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        : items;
    const inStock = soldOutOnly ? inCategory.filter((i) => i.status === "OUT_OF_STOCK") : inCategory;
    const filtered = inStock.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    const canReorder = Boolean(onReorderItems && categoryId && !search.trim() && !soldOutOnly);

    // AGF-S2-08A: drag a card with the mouse, a press-and-hold on touch screens (a quick swipe still scrolls)
    // or the keyboard; one reorder at a time
    const sensors = useSensors(
        useSensor(CardMouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(CardTouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(CardKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const nameOf = (id: unknown) => filtered.find((i) => i.id === id)?.name ?? "Item";
    const positionOf = (id: unknown) => filtered.findIndex((i) => i.id === id) + 1;
    const total = filtered.length;
    // Announce a move only when the target position changes (dnd-kit reports "over itself" right after pick-up)
    const lastOver = useRef<unknown>(null);
    const announcements: Announcements = {
        onDragStart: ({ active }) => {
            lastOver.current = active.id;
            return `Picked up ${nameOf(active.id)}. It is in position ${positionOf(active.id)} of ${total}.`;
        },
        onDragOver: ({ active, over }) => {
            if ((over?.id ?? null) === lastOver.current) return undefined;
            lastOver.current = over?.id ?? null;
            return over
                ? `${nameOf(active.id)} was moved to position ${positionOf(over.id)} of ${total}.`
                : `${nameOf(active.id)} is no longer over a position in the grid.`;
        },
        onDragEnd: ({ active, over }) =>
            over
                ? `${nameOf(active.id)} was dropped at position ${positionOf(over.id)} of ${total}.`
                : `${nameOf(active.id)} was dropped. Its position did not change.`,
        onDragCancel: ({ active }) =>
            `Dragging was cancelled. ${nameOf(active.id)} was returned to position ${positionOf(active.id)} of ${total}.`,
    };

    const handleDragEnd = async ({ active, over }: DragEndEvent) => {
        if (!onReorderItems || !canReorder || moving || !over || active.id === over.id) return; // dropped in place
        const ids = filtered.map((i) => i.id);
        const orderedIds = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
        setMoving(true);
        setMoveError("");
        try {
            await onReorderItems(categoryId, orderedIds);
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

            {onReorderItems && (
                <p className="text-xs text-gray-500">
                    {!categoryId
                        ? "Choose a category to change the order of its items."
                        : search.trim()
                            ? "Clear the search to change the order."
                            : soldOutOnly
                                ? "Show all items to change the order."
                                : "Drag a card to change the order. Guests see the same order."}
                </p>
            )}
            {soldOutOnly && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <span>Showing sold-out items only.</span>
                    <button type="button" onClick={showAllItems} className="font-medium underline hover:no-underline">
                        Show all items
                    </button>
                </div>
            )}
            {moving && <p role="status" className="text-xs text-gray-500">Saving order…</p>}
            {moveError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{moveError}</p>}

            {filtered.length === 0 ? (
                <p className="text-sm text-gray-500">No items found.</p>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    accessibility={{ announcements, screenReaderInstructions: { draggable: ITEM_DRAG_INSTRUCTIONS } }}
                >
                    <SortableContext items={filtered.map((i) => i.id)} strategy={rectSortingStrategy}>
                        <div role="list" aria-label="Items" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filtered.map((item, index) => (
                                <SortableItemCard
                                    key={item.id}
                                    id={item.id}
                                    name={item.name}
                                    index={index}
                                    enabled={canReorder}
                                    disabled={moving}
                                >
                                    <ItemCard
                                        currency={currency}
                                        item={item}
                                        onEdit={() => openEdit(item)}
                                        onToggle={() => toggleStatus(item.id)}
                                        onSoldOutToggle={toggleSoldOut ? () => toggleSoldOut(item.id) : undefined}
                                        onDelete={() => openDelete(item)}
                                    />
                                </SortableItemCard>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
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
