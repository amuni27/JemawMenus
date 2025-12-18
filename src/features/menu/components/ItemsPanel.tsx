import ItemGrid from './ItemGrid';
import {Category, CreateItemPayload, MenuItem} from "../../../types/menu.ts";

interface Props {
    menuId?: string;
    categories: Category[]
    items: MenuItem[],
    toggleStatus: (itemId: string) => Promise<MenuItem | undefined>;
    deleteItem: (itemId: string) => Promise<void>;
    onCreate: (payload: CreateItemPayload) => Promise<MenuItem>;
    onUpdate: (itemId: string, patch: Partial<MenuItem>) => Promise<MenuItem>;
}

export default function ItemsPanel({menuId, categories, items, toggleStatus,deleteItem,onUpdate, onCreate}: Props) {
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
            />
        </div>
    );
}
