import StatusBadge from './StatusBadge.tsx';
import { formatPrice } from "../../utils/currency";
import {ItemStatus, MenuItem} from '../../types/menu.ts';
import {Pencil, Trash2} from "lucide-react";

interface Props {
    item: MenuItem;
    onEdit: () => void;
    onToggle: () => void; // Hide (-> UNAVAILABLE) / Show (-> AVAILABLE)
    onSoldOutToggle?: () => void; // Mark sold out (-> OUT_OF_STOCK) / Back in stock (-> AVAILABLE)
    onDelete: () => void;
    /** The restaurant's currency (AGF-S2-02) */
    currency?: string;
}

export default function ItemCard({item, onEdit, onToggle, onSoldOutToggle, onDelete, currency}: Props) {
    const status = (item.status ?? "AVAILABLE") as ItemStatus;
    // ✅ Normalize price safely (handles string or number)
    const price =
        typeof item.price === 'number'
            ? item.price
            : Number(item.price ?? 0);


    return (
        <div className="relative overflow-hidden rounded-2xl border bg-white shadow transition hover:shadow-md">


            <img
                src={item.imageUrl ?? undefined}
                alt={item.name}
                className="h-32 w-full object-cover"
            />

            <div className="p-4 space-y-1">
                <h3 className="font-semibold">{item.name}</h3>

                <p className="text-sm text-gray-500">
                    {formatPrice(price, currency)}
                </p>

                <StatusBadge status={status} />

                {onSoldOutToggle && status !== "UNAVAILABLE" ? (
                    <button
                        onClick={onSoldOutToggle}
                        className="mt-1 block rounded border px-2 py-1 text-xs hover:bg-gray-50"
                    >
                        {status === "OUT_OF_STOCK" ? "Back in stock" : "Mark sold out"}
                    </button>
                ) : null}
            </div>

            <div className="absolute top-2 right-2 flex gap-1">
                <button
                    onClick={onToggle}
                    className="rounded bg-white/80 px-2 py-1 text-xs shadow hover:bg-white"
                >
                    {status === "UNAVAILABLE" ? 'Show' : 'Hide'}
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
