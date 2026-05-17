import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import { FormInput } from "../form/FormInput";
import Button from "../ui/Button";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { profileApi } from "../../api/profileApi";
import { useToast } from "../ui/ToastContext";
import { UserDTO } from "../../services/authService";

interface Props {
  open: boolean;
  onClose: () => void;
  user: UserDTO;
  onSaved: () => void;
}

const phoneInputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm " +
  "focus-within:ring-2 focus-within:ring-brand focus-within:border-brand-dark";

const isValidEthiopianPhone = (p?: string) =>
  !p || (p.startsWith("+251") && isValidPhoneNumber(p));

export default function UserProfileModal({ open, onClose, user, onSaved }: Props) {
  const toast = useToast();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFullName(user.fullName ?? "");
    setPhone(user.phoneNumber ?? "");
    setError("");
  }, [open, user]);

  const handleSave = async () => {
    if (!fullName.trim()) { setError("Full name is required"); return; }
    if (phone && !isValidEthiopianPhone(phone)) { setError("Enter a valid Ethiopian phone number"); return; }

    setSaving(true);
    setError("");
    try {
      await profileApi.updateUser({
        fullName: fullName.trim(),
        phoneNumber: phone || undefined,
      });
      toast("Profile updated");
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title="Edit Profile" onClose={onClose} />
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <FormInput
          label="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <PhoneInput
            international
            defaultCountry="ET"
            countries={["ET"]}
            countryCallingCodeEditable={false}
            value={phone}
            onChange={(v) => setPhone(v || "")}
            className={phoneInputClass}
          />
          {phone && !isValidEthiopianPhone(phone) && (
            <p className="mt-1 text-sm text-red-600">Enter a valid Ethiopian phone number.</p>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} isLoading={saving}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}