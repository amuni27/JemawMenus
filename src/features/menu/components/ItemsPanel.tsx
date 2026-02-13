import ItemGrid from "./ItemGrid";
import { Category, CreateItemPayload, MenuItem } from "../../../types/menu.ts";

interface Props {
    menuId?: string;
    categories: Category[];
    items: MenuItem[];
    toggleStatus: (itemId: string) => Promise<MenuItem | undefined>;
    deleteItem: (itemId: string) => Promise<void>;
    onCreate: (payload: CreateItemPayload) => Promise<MenuItem>;
    onUpdate: (itemId: string, patch: Partial<MenuItem>) => Promise<MenuItem>;

    // ✅ NEW: for image upload flow
    onConfirmImage: (itemId: string, objectKey: string) => Promise<MenuItem>;

    // ✅ NEW: presign upload URL (create/edit when image selected)
    onPresignImage: (itemId: string) => Promise<{
        item: MenuItem;
        upload?: { uploadUrl: string; objectKey: string; expiresInSeconds?: number } | null;
    }>;
}

export default function ItemsPanel({
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
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <ItemGrid
                menuId={menuId}
                categories={categories}
                items={items}
                toggleStatus={toggleStatus}
                deleteItem={deleteItem}
                onUpdate={onUpdate}
                onCreate={onCreate}
                onConfirmImage={onConfirmImage}
                onPresignImage={onPresignImage}
            />
        </div>
    );
}
