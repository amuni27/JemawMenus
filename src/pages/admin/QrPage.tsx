import QRCode from 'react-qr-code';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useParams } from 'react-router-dom';

export default function QrPage() {
  const { tenantSlug } = useParams();
  if (!tenantSlug) return null;

  const url = `${window.location.origin}/${tenantSlug}/menu`;
  const download = () => {
    const svg = document.getElementById('qrCode') as SVGElement | null;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tenantSlug}-menu-qr.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <Card className="flex flex-col items-center gap-4">
      <h1 className="text-xl font-semibold">QR Code for Customer Menu</h1>
      <QRCode id="qrCode" value={url} size={256} level="H" />
      <p className="text-sm text-gray-600">URL: {url}</p>
      <Button onClick={download}>Download SVG</Button>
    </Card>
  );
}
