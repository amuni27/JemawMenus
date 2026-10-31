import ItemGrid from "./ItemGrid.tsx";
import { Category, CreateItemPayload, MenuItem } from "../../types/menu.ts";

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
    onCreate: (payload: CreateItemPayload) => Promise<MenuItem>;
    onUpdate: (itemId: string, patch: Partial<MenuItem>) => Promise<MenuItem>;

    // ✅ NEW: for image upload flow
    onConfirmImage: (itemId: string, objectKey: string) => Promise<MenuItem>;

    // ✅ NEW: presign upload URL (create/edit when image selected)
    // AGF-S2-16: remove the item's photo
    onRemoveImage?: (itemId: string) => Promise<MenuItem>;
    onPresignImage: (itemId: string, contentType: string) => Promise<{
        item: MenuItem;
        upload?: { uploadUrl: string; objectKey: string; expiresInSeconds?: number } | null;
    }>;
}

export default function ItemsPanel({
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
                                       onRemoveImage,
                                       currency,
                                   }: Props) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <ItemGrid
                menuId={menuId}
                categories={categories}
                items={items}
                toggleStatus={toggleStatus}
                toggleSoldOut={toggleSoldOut}
                deleteItem={deleteItem}
                onReorderItems={onReorderItems}
                onUpdate={onUpdate}
                onCreate={onCreate}
                onConfirmImage={onConfirmImage}
                onPresignImage={onPresignImage}
                onRemoveImage={onRemoveImage}
                currency={currency}
            />
        </div>
    );
}
