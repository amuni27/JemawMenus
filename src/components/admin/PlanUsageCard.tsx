interface Props {
  used: number;
  limit: number;
}

export default function PlanUsageCard({ used, limit }: Props) {
  const percent = Math.min(100, (used / limit) * 100);
  return (
    <div className="rounded-xl bg-blue-100 p-4 text-center text-xs font-medium text-gray-800">
      <div className="mb-2">Free plan</div>
      <div className="h-2 w-full overflow-hidden rounded bg-white">
        <div className="h-full bg-blue-500" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1">{used} of {limit} QRs used</div>
      <button className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-1 text-white hover:bg-blue-700">
        Upgrade now
      </button>
    </div>
  );
}
