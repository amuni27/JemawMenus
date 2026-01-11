import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import { buildMenuUrl } from "../../utils/buildMenuUrl";
import QRCode from "react-qr-code";
import { useAuth } from "../../app/context/AuthContext";

export default function QRPage() {
  const [loading] = useState(false);
  const [error] = useState<string>("");
  const auth = useAuth();

  if (loading) return <p className="p-6">Loading...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  const qrValue = buildMenuUrl(auth.business?.id);

  return (
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <nav className="mb-1 text-sm text-gray-500">
              <Link to={`/ert/admin/menus`} className="hover:underline">
                Admin
              </Link>
              <span className="mx-1">/</span>
              <span>QR Code</span>
            </nav>
            <h2 className="text-2xl font-bold">QR Code</h2>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* QR card */}
          <aside className="flex justify-center lg:justify-start">
            <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-5 shadow-lg sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Scan to open menu</p>
                  <p className="text-xs text-gray-500">Customers can scan this QR</p>
                </div>
              </div>

              <div className="mt-4 flex justify-center">
                {/* Responsive QR wrapper */}
                <div className="w-full max-w-[260px]">
                  <QRCode value={qrValue} className="h-auto w-full" level="M" />
                </div>
              </div>

              {/* Optional: show link */}
              <div className="mt-4 break-all rounded-md bg-gray-50 p-3 text-xs text-gray-600">
                {qrValue}
              </div>

              {/* Optional actions */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button variant="secondary" className="w-full">
                  Download
                </Button>
                <Button className="w-full">Print</Button>
              </div>
            </div>
          </aside>

          {/* Right content */}
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-base font-semibold text-gray-900">QR Settings</h3>
            <p className="mt-2 text-sm text-gray-600">
              You can add instructions here (table number, custom label, size, etc).
            </p>
          </section>
        </div>
      </div>
  );
}
