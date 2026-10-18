// Error message with a Retry action for pages whose data failed to load (AGF-S1-11)
export default function LoadError({message, onRetry}: { message: string; onRetry: () => void }) {
    return (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{message}</p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
            >
                Retry
            </button>
        </div>
    );
}
