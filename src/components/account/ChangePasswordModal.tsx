import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import { FormInput } from "../form/FormInput";
import Button from "../ui/Button";
import { profileApi } from "../../api/profileApi";
import { useToast } from "../ui/ToastContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ open, onClose }: Props) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCurrent("");
    setNext("");
    setConfirm("");
    setError("");
  }, [open]);

  const handleSave = async () => {
    if (!current) { setError("Current password is required"); return; }
    if (next.length < 8) { setError("New password must be at least 8 characters"); return; }
    if (next !== confirm) { setError("Passwords do not match"); return; }

    setSaving(true);
    setError("");
    try {
      await profileApi.changePassword({ currentPassword: current, newPassword: next });
      toast("Password changed");
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title="Change Password" onClose={onClose} />
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <FormInput
          label="Current Password"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <FormInput
          label="New Password"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <FormInput
          label="Confirm New Password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {confirm && next !== confirm && (
          <p className="text-sm text-red-600">Passwords do not match.</p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} isLoading={saving}>Change Password</Button>
        </div>
      </div>
    </Modal>
  );
}