import { useEffect, useRef, useState } from "react";
import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import Button from "../ui/Button";
import BusinessLogo from "../ui/BusinessLogo";
import { profileApi } from "../../api/profileApi";
import { useToast } from "../ui/ToastContext";
import { BusinessDTO } from "../../services/authService";
import { ALLOWED_IMAGE_TYPES, imageFileProblem } from "../../utils/imagePolicy";
import { uploadToR2 } from "../../utils/r2Service";
import { errorMessage } from "../../utils/errorMessage";

interface Props {
  open: boolean;
  onClose: () => void;
  business: BusinessDTO;
  onSaved: () => void;
}

/**
 * AGF-S2-01: the owner picks a logo file, which goes through the secure presign → upload → confirm flow
 * (same type, size and HEIC rules as item images, AGF-S1-17), or removes the current logo.
 */
export default function BusinessLogoModal({ open, onClose, business, onSaved }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState<"" | "uploading" | "removing">("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setPreview("");
    setError("");
    setBusy("");
    if (inputRef.current) inputRef.current.value = "";
  }, [open, business]);

  // Release the local preview of the chosen file
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const handleFile = (chosen: File | null) => {
    setError("");
    if (!chosen) {
      setFile(null);
      setPreview("");
      return;
    }
    const problem = imageFileProblem(chosen);
    if (problem) {
      setFile(null);
      setPreview("");
      setError(problem);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
  };

  const handleSave = async () => {
    if (!file) return;
    setBusy("uploading");
    setError("");
    try {
      const presigned = await profileApi.presignLogo(business.id, { fileName: file.name, contentType: file.type });
      const { uploadUrl, objectKey } = presigned.data;
      try {
        await uploadToR2(uploadUrl, file);
      } catch {
        setError("Couldn't upload the logo. Check your connection and try again.");
        return;
      }
      await profileApi.confirmLogo(business.id, objectKey);
      toast("Logo updated");
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Failed to update logo"));
    } finally {
      setBusy("");
    }
  };

  const handleRemove = async () => {
    setBusy("removing");
    setError("");
    try {
      await profileApi.removeLogo(business.id);
      toast("Logo removed");
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Failed to remove logo"));
    } finally {
      setBusy("");
    }
  };

  const currentLogo = business.logoUrl || "";

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title="Edit Business Logo" onClose={onClose} />
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {/* Preview: the chosen file, else the current logo, else the initials */}
        <div className="flex justify-center">
          <BusinessLogo
            name={business.name}
            logoUrl={preview || currentLogo}
            className="h-24 w-24 rounded-2xl border border-gray-200 text-2xl shadow-sm"
          />
        </div>

        <div>
          <label htmlFor="business-logo-file" className="block text-sm font-medium text-gray-700 mb-1">
            Logo image
          </label>
          <input
            id="business-logo-file"
            ref={inputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            disabled={!!busy}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
          />
          <p className="mt-1 text-xs text-gray-400">JPEG, PNG or WebP, up to 8 MB. A square image works best.</p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div>
            {currentLogo && !file && (
              <Button variant="danger" onClick={handleRemove} isLoading={busy === "removing"} disabled={!!busy}>
                Remove logo
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} disabled={!!busy}>Cancel</Button>
            <Button onClick={handleSave} isLoading={busy === "uploading"} disabled={!file || !!busy}>
              Save Logo
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
