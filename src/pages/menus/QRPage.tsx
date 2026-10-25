import {useMemo, useRef} from "react";
import Button from "../../components/ui/Button";
import {publicMenuUrl} from "../../utils/publicMenuUrl";
import {a5SheetHtml, qrFileName, tableTentHtml} from "../../utils/printKit";
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
        } catch (e) {
            reject(e);
        }
    });
}

export default function QRPage() {
    const auth = useAuth();

    // ✅ Wrap ref (NOT svg ref) – avoids react-qr-code ref typing issue
    const qrWrapRef = useRef<HTMLDivElement | null>(null);

    const businessName = auth.business?.name ?? "Venue";
    const businessId = auth.business?.id;
    const logoUrl = auth.business?.logoUrl ?? null;

    // AGF-S2-20 / D2: the configured guest menu address; null when the configuration is invalid (fail closed)
    const qrValue = useMemo(() => (businessId ? publicMenuUrl(businessId) : null), [businessId]);

    const getSvgEl = (): SVGSVGElement | null => {
        return (qrWrapRef.current?.querySelector("svg") as SVGSVGElement | null) ?? null;
    };

    const handleDownloadSvg = () => {
        const svgEl = getSvgEl();
        if (!svgEl) return;

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgEl);

        const blob = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
        downloadBlob(blob, qrFileName(businessName, "svg"));
    };

    const handleDownloadPng = async () => {
        const svgEl = getSvgEl();
        if (!svgEl) return;

        // 1024px looks sharp for print
        const pngDataUrl = await svgToPngDataUrl(svgEl, 1024);

        // Convert dataURL to Blob
        const res = await fetch(pngDataUrl);
        const blob = await res.blob();
        downloadBlob(blob, qrFileName(businessName, "png"));
    };

    // AGF-S2-20: A5 sheet or table tent, built from the on-screen QR with escaped content
    const handlePrint = (layout: "a5" | "tent") => {
        const svgEl = getSvgEl();
        if (!svgEl || !qrValue) return;

        const input = {name: businessName, logoUrl, url: qrValue, qrSvg: new XMLSerializer().serializeToString(svgEl)};
        const html = layout === "a5" ? a5SheetHtml(input) : tableTentHtml(input);

        const win = window.open("", "_blank", "width=900,height=700");
        if (!win) return;
        win.document.open();
        win.document.write(html);
        win.document.close();
    };

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <nav className="mb-1 text-sm text-gray-500">
                        Venue
                        <span className="mx-1">/</span>
                        <span>qrcode</span>
                    </nav>
                    <h2 className="text-2xl font-bold">QR Code</h2>
                </div>

                {qrValue && (
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:w-auto lg:justify-end">
                        <Button variant="secondary" className="w-full sm:w-auto" onClick={handleDownloadPng}>
                            Download PNG
                        </Button>
                        <Button variant="secondary" className="w-full sm:w-auto" onClick={handleDownloadSvg}>
                            Download SVG
                        </Button>
                        <Button className="w-full sm:w-auto" onClick={() => handlePrint("a5")}>
                            Print A5 sheet
                        </Button>
                        <Button className="w-full sm:w-auto" onClick={() => handlePrint("tent")}>
                            Print table tent
                        </Button>
                    </div>
                )}
            </div>

            {!qrValue ? (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    The guest menu address isn't configured correctly. Contact support.
                </p>
            ) : (
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
                            <b>Print A5 sheet</b> makes one sign per page with your logo and name.
                        </li>
                        <li>
                            <b>Print table tent</b> prints on A4 landscape: fold along the dashed line and stand it on the table.
                        </li>
                        <li>
                            The QR code opens your guest menu at the address shown under it.
                        </li>
                    </ul>
                </section>
            </div>
            )}
        </div>
    );
}
