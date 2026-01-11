import {useMemo, useRef, useState} from "react";
import {Link} from "react-router-dom";
import Button from "../../components/ui/Button";
import {buildMenuUrl} from "../../utils/buildMenuUrl";
import QRCode from "react-qr-code";
import {useAuth} from "../../app/context/AuthContext";

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function svgToPngDataUrl(svgEl: SVGSVGElement, sizePx = 1024): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgEl);

            const svgBlob = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
            const svgUrl = URL.createObjectURL(svgBlob);

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = sizePx;
                canvas.height = sizePx;

                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    URL.revokeObjectURL(svgUrl);
                    reject(new Error("Canvas not supported"));
                    return;
                }

                // White background so PNG isn't transparent
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Draw image scaled to canvas
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const pngUrl = canvas.toDataURL("image/png");
                URL.revokeObjectURL(svgUrl);
                resolve(pngUrl);
            };

            img.onerror = () => {
                URL.revokeObjectURL(svgUrl);
                reject(new Error("Failed to convert SVG to PNG"));
            };

            img.src = svgUrl;
        } catch (e: any) {
            reject(e);
        }
    });
}

export default function QRPage() {
    const [loading] = useState(false);
    const [error] = useState<string>("");
    const auth = useAuth();

    // ✅ Wrap ref (NOT svg ref) – avoids react-qr-code ref typing issue
    const qrWrapRef = useRef<HTMLDivElement | null>(null);

    const businessName = auth.business?.name ?? "Venue";
    const businessId = auth.business?.id;

    const qrValue = useMemo(() => buildMenuUrl(businessId), [businessId]);

    if (loading) return <p className="p-6">Loading...</p>;
    if (error) return <p className="p-6 text-red-600">{error}</p>;

    const getSvgEl = (): SVGSVGElement | null => {
        return (qrWrapRef.current?.querySelector("svg") as SVGSVGElement | null) ?? null;
    };

    const handleDownloadSvg = () => {
        const svgEl = getSvgEl();
        if (!svgEl) return;

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgEl);

        const blob = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
        downloadBlob(blob, `${businessName}-qr.svg`);
    };

    const handleDownloadPng = async () => {
        const svgEl = getSvgEl();
        if (!svgEl) return;

        // 1024px looks sharp for print
        const pngDataUrl = await svgToPngDataUrl(svgEl, 1024);

        // Convert dataURL to Blob
        const res = await fetch(pngDataUrl);
        const blob = await res.blob();
        downloadBlob(blob, `${businessName}-qr.png`);
    };

    const handlePrint = () => {
        const svgEl = getSvgEl();
        if (!svgEl) return;

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgEl);

        const win = window.open("", "_blank", "width=900,height=700");
        if (!win) return;

        win.document.open();
        win.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${businessName} - QR Code</title>
          <style>
            @page { margin: 16mm; }
            body {
              font-family: Arial, sans-serif;
              color: #111;
              margin: 0;
              padding: 0;
            }
            .page {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              gap: 16px;
              text-align: center;
            }
            .title {
              font-size: 22px;
              font-weight: 700;
            }
            .subtitle {
              font-size: 13px;
              color: #444;
              max-width: 600px;
            }
            .qr-wrap {
              width: 320px;
              height: 320px;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 16px;
              border: 1px solid #ddd;
              border-radius: 12px;
            }
            .qr-wrap svg { width: 100%; height: 100%; }
            .url {
              font-size: 11px;
              color: #666;
              word-break: break-all;
              max-width: 600px;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="title">${businessName}</div>
            <div class="subtitle">Scan to open our menu</div>
            <div class="qr-wrap">${svgString}</div>
            <div class="url">${qrValue}</div>
          </div>
          <script>
            window.onload = () => {
              window.focus();
              window.print();
              window.onafterprint = () => window.close();
            }
          </script>
        </body>
      </html>
    `);
        win.document.close();
    };

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <nav className="mb-1 text-sm text-gray-500">
                        Venue
                        <span className="mx-1">/</span>
                        <span>qrcode</span>
                    </nav>
                    <h2 className="text-2xl font-bold">QR Code</h2>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                    <Button variant="secondary" className="w-full sm:w-auto" onClick={handleDownloadPng}>
                        Download PNG
                    </Button>
                    <Button variant="secondary" className="w-full sm:w-auto" onClick={handleDownloadSvg}>
                        Download SVG
                    </Button>
                    <Button className="w-full sm:w-auto" onClick={handlePrint}>
                        Print
                    </Button>
                </div>
            </div>

            {/* Main grid */}
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                {/* QR card */}
                <aside className="flex justify-center lg:justify-start">
                    <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-5 shadow-lg sm:p-6">
                        <p className="text-sm font-medium text-gray-900">Scan to open menu</p>
                        <p className="mt-1 text-xs text-gray-500">Customers can scan this QR</p>

                        <div className="mt-4 flex justify-center">
                            {/* ✅ ref goes here (wrapper), not on <QRCode /> */}
                            <div ref={qrWrapRef} className="w-full max-w-[260px]">
                                <QRCode value={qrValue} className="h-auto w-full" level="M"/>
                            </div>
                        </div>

                        <div className="mt-4 break-all rounded-md bg-gray-50 p-3 text-xs text-gray-600">

                            <a
                                href={qrValue}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline hover:text-blue-800"
                            >
                                {qrValue}
                            </a>
                        </div>
                    </div>
                </aside>

                {/* Right content */}
                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                    <h3 className="text-base font-semibold text-gray-900">Tips</h3>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-600">
                        <li>
                            Use <b>PNG</b> for sharing on WhatsApp and social media.
                        </li>
                        <li>
                            Use <b>SVG</b> for best quality in design tools.
                        </li>
                        <li>
                            Use <b>Print</b> to generate a clean A4 print page.
                        </li>
                    </ul>
                </section>
            </div>
        </div>
    );
}
