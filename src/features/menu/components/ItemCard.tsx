import StatusBadge from './StatusBadge';
import {MenuItem} from '../../../types/menu';
import {Pencil, Trash2} from "lucide-react";

interface Props {
    item: MenuItem;
    onEdit: () => void;
    onToggle: () => void;
    onDelete: () => void;
}

export default function ItemCard({item, onEdit, onToggle, onDelete}: Props) {
    // ✅ Normalize price safely (handles string or number)
    const price =
        typeof item.price === 'number'
            ? item.price
            : Number(item.price ?? 0);

    return (
        <div className="relative overflow-hidden rounded-2xl border bg-white shadow transition hover:shadow-md">

            <img
                src={item.imageUrl}
                alt={item.name}
                className="h-32 w-full object-cover"
            />

            <div className="p-4 space-y-1">
                <h3 className="font-semibold">{item.name}</h3>

                <p className="text-sm text-gray-500">
                    ${price.toFixed(2)}
                </p>

                <StatusBadge status={item.status}/>
            </div>

            <div className="absolute top-2 right-2 flex gap-1">
                <button
                    onClick={onToggle}
                    className="rounded bg-white/80 px-2 py-1 text-xs shadow hover:bg-white"
                >
                    {item.status === 'AVAILABLE' ? 'Hide' : 'Show'}
                </button>
                <button
                    onClick={onEdit}
                    className="rounded bg-white/80 px-2 py-1 text-xs shadow hover:bg-white"
                >
                    <Pencil size={16}/>
                </button>
                <button
                    onClick={onDelete}
                    className="rounded bg-white/80 px-2 py-1 text-xs shadow hover:bg-white"
                >
                    <Trash2 size={16}/>
                </button>
            </div>
        </div>
    );
}
