import { PropsWithChildren } from "react";
import QRCode from "react-qr-code";
import { buildMenuUrl } from "../../utils/buildMenuUrl";
import Button from "../ui/Button";

interface Props {
  tenantSlug: string;
  menuId: string;
  onClose: () => void;
}

export default function MenuQrModal({ tenantSlug, menuId, onClose }: Props) {
  const url = buildMenuUrl(tenantSlug);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!doctype html><html><head><title>QR Code</title></head><body style=\"display:flex;justify-content:center;align-items:center;height:100vh;margin:0;\">`);
    printWindow.document.write(`<div id=\"qrcode\"></div>`);
    printWindow.document.write(`<script src=\"https://unpkg.com/react-qr-code/dist/index.umd.js\"></script>`);
    printWindow.document.write(`<script>const QRCode = window['react-qr-code'];document.getElementById('qrcode').innerHTML='<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"256\" height=\"256\"/>', new QRCode({value: '${url}', size: 256});</script>`);
    printWindow.document.write(`</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Menu QR Code</h2>
        <QRCode value={url} size={256} />
        <p className="mt-4 text-sm text-gray-500 break-all text-center">
          <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
          >
            View Menu
          </a>
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={handlePrint}>Print</Button>
        </div>
      </div>
    </div>
  );
}
