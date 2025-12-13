import QRCode from 'react-qr-code';

interface Props {
  url: string;
  onClose: () => void;
}

export default function QrModal({ url, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-center text-xl font-semibold">Scan to open</h2>
        <div className="flex justify-center">
          <QRCode value={url} size={224} />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 focus:outline-none"
          />
          <button
            className="rounded-md bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
            onClick={() => navigator.clipboard.writeText(url)}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
