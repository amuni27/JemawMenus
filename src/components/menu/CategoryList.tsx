import {useRef, useState, type ReactNode} from "react";
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
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import CategoryModal from "./CategoryModal.tsx";
import type {Category} from "../../types/menu.ts";
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Pencil, Trash2 } from "lucide-react";
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
    /** AGF-S2-07A: save a new order of all categories (drag and drop) */
    onReorder?: (orderedIds: string[]) => Promise<void>;
}

const DRAG_INSTRUCTIONS =
    "To reorder a category, focus its drag handle and press Space to pick it up. " +
    "Use the up and down arrow keys to move it, then press Space to drop it, or Escape to cancel.";

/** AGF-S2-07A: a category row that can be dragged by its handle */
function SortableCategoryRow({ id, name, index, draggable, disabled, children }: {
    id: string;
    name: string;
    index: number;
    draggable: boolean;
    disabled: boolean;
    children: ReactNode;
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
        useSortable({ id, disabled: !draggable || disabled });

    return (
        <li
            ref={setNodeRef}
            data-name={name}
            data-index={index}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`flex items-center justify-between gap-2 rounded border bg-white px-2 py-1 text-sm ${
                isDragging ? "relative z-10 border-brand shadow-lg ring-2 ring-brand/30" : ""
            }`}
        >
            {draggable && (
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    {...attributes}
                    {...listeners}
                    aria-label={`Drag ${name} to reorder`}
                    className={`flex h-9 w-7 shrink-0 touch-manipulation items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 ${
                        disabled ? "cursor-not-allowed opacity-40" : isDragging ? "cursor-grabbing" : "cursor-grab"
                    }`}
                >
                    <GripVertical size={16} />
                </button>
            )}
            {children}
        </li>
    );
}

export default function CategoryList({ menuId, categories, loading, error, onCreate, onUpdate, onDelete, onToggleActive, onMove, onReorder }: Props) {

    // AGF-S2-07: one move at a time; a failed save restores the order and explains why
    const [moving, setMoving] = useState(false);
    const [moveError, setMoveError] = useState("");

    // One reorder at a time, whether from the buttons or a drop (S2-07A)
    const saveOrder = async (action: () => Promise<void>) => {
        if (moving) return;
        setMoving(true);
        setMoveError("");
        try {
            await action();
        } catch (err) {
            setMoveError(`Couldn't save the new order: ${errorMessage(err, "Please try again.")}`);
        } finally {
            setMoving(false);
        }
    };

    const move = (categoryId: string, direction: -1 | 1) => {
        if (onMove) void saveOrder(() => onMove(categoryId, direction));
    };

    // AGF-S2-07A: drag by the handle with a mouse, a press-and-hold on touch screens (a quick swipe still
    // scrolls the page), or the keyboard
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const nameOf = (id: unknown) => categories.find((c) => c.id === id)?.name ?? "Category";
    const positionOf = (id: unknown) => categories.findIndex((c) => c.id === id) + 1;
    const total = categories.length;
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
                : `${nameOf(active.id)} is no longer over a position in the list.`;
        },
        onDragEnd: ({ active, over }) =>
            over
                ? `${nameOf(active.id)} was dropped at position ${positionOf(over.id)} of ${total}.`
                : `${nameOf(active.id)} was dropped. Its position did not change.`,
        onDragCancel: ({ active }) =>
            `Dragging was cancelled. ${nameOf(active.id)} was returned to position ${positionOf(active.id)} of ${total}.`,
    };

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!onReorder || !over || active.id === over.id) return; // dropped where it started: nothing to save
        const ids = categories.map((c) => c.id);
        const orderedIds = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
        void saveOrder(() => onReorder(orderedIds));
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
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    accessibility={{ announcements, screenReaderInstructions: { draggable: DRAG_INSTRUCTIONS } }}
                >
                <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1" aria-label="Categories">
                    {categories.map((c, index) => (
                        <SortableCategoryRow
                            key={c.id}
                            id={c.id}
                            name={c.name}
                            index={index}
                            draggable={Boolean(onReorder)}
                            disabled={moving}
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
                        </SortableCategoryRow>
                    ))}
                </ul>
                </SortableContext>
                </DndContext>

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
