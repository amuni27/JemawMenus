import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import Button from "../ui/Button";
import { profileApi } from "../../api/profileApi";
import { useToast } from "../ui/ToastContext";
import { BusinessDTO } from "../../services/authService";

interface Props {
  open: boolean;
  onClose: () => void;
  business: BusinessDTO;
  onSaved: () => void;
}

export default function BusinessLogoModal({ open, onClose, business, onSaved }: Props) {
  const toast = useToast();
  const [logoUrl, setLogoUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const current = (business as any).logoUrl ?? "";
    setLogoUrl(current);
    setPreview(current);
    setError("");
  }, [open, business]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await profileApi.updateBusiness(business.id, { logoUrl: logoUrl.trim() || undefined });
      toast("Logo updated");
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update logo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title="Edit Business Logo" onClose={onClose} />
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {/* Preview */}
        <div className="flex justify-center">
          {preview ? (
            <img
              src={preview}
              alt="Business logo"
              className="h-24 w-24 rounded-2xl object-cover border border-gray-200 shadow-sm"
              onError={() => setPreview("")}
            />
          ) : (
            <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
              <span className="text-xs text-gray-400">No logo</span>
            </div>
          )}
        </div>

        {/* URL input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
          <input
            type="url"
            value={logoUrl}
            placeholder="https://example.com/logo.png"
            onChange={(e) => {
              setLogoUrl(e.target.value);
              setPreview(e.target.value);
            }}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand-dark"
          />
          <p className="mt-1 text-xs text-gray-400">Paste a direct link to your logo image.</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} isLoading={saving}>Save Logo</Button>
        </div>
      </div>
    </Modal>
  );
}