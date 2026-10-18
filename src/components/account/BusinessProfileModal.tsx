import { useEffect, useState } from "react";
import { FormSelect } from "../form/FormSelect";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, displayCurrency } from "../../utils/currency";
import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import { FormInput } from "../form/FormInput";
import Button from "../ui/Button";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { profileApi } from "../../api/profileApi";
import { useToast } from "../ui/ToastContext";
import { BusinessDTO } from "../../services/authService";

interface Props {
  open: boolean;
  onClose: () => void;
  business: BusinessDTO;
  onSaved: () => void;
}

const phoneInputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm " +
  "focus-within:ring-2 focus-within:ring-brand focus-within:border-brand-dark";

const isValidEthiopianPhone = (p?: string) =>
  !p || (p.startsWith("+251") && isValidPhoneNumber(p));

export default function BusinessProfileModal({ open, onClose, business, onSaved }: Props) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(business.name ?? "");
    setPhone(business.businessPhone ?? "");
    setAddress(business.streetAddress ?? "");
    setCity(business.city ?? "");
    setRegion(business.state ?? "");
    setZipcode(business.zipcode ?? "");
    setCurrency(displayCurrency(business.currency));
    setError("");
  }, [open, business]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Business name is required"); return; }
    if (phone && !isValidEthiopianPhone(phone)) { setError("Enter a valid Ethiopian phone number"); return; }

    setSaving(true);
    setError("");
    try {
      await profileApi.updateBusiness(business.id, {
        name: name.trim(),
        businessPhone: phone || undefined,
        streetAddress: address.trim() || undefined,
        city: city.trim() || undefined,
        state: region.trim() || undefined,
        zipcode: zipcode.trim() || undefined,
        // Only when changed, so a legacy stored value never blocks other profile edits
        currency: currency !== displayCurrency(business.currency) ? currency : undefined,
      });
      toast("Business profile updated");
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to update business profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader title="Edit Business Profile" onClose={onClose} />
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <FormInput
          label="Business Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Phone</label>
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
        <FormInput
          label="Street Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <FormInput
            label="Region"
            value={region}
            placeholder="Addis Ababa, Oromia..."
            onChange={(e) => setRegion(e.target.value)}
          />
        </div>
        <FormInput
          label="Postal Code"
          value={zipcode}
          onChange={(e) => setZipcode(e.target.value)}
        />

        {/* AGF-S2-02: one currency for all prices on this restaurant's menus */}
        <FormSelect label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          {!(SUPPORTED_CURRENCIES as readonly string[]).includes(displayCurrency(business.currency)) && (
            <option value={displayCurrency(business.currency)}>{displayCurrency(business.currency)} (current)</option>
          )}
        </FormSelect>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} isLoading={saving}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}