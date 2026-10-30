import { useEffect, useState } from "react";
import { useFieldErrors } from "../../utils/fieldErrors";
import { FormSelect } from "../form/FormSelect";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, displayCurrency } from "../../utils/currency";
import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import { FormInput } from "../form/FormInput";
import Button from "../ui/Button";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { profileApi } from "../../api/profileApi";
import { GOOGLE_MAPS_FIND_URL, googleMapsUrlProblem } from "../../utils/googleMapsUrl";
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
  const [locationUrl, setLocationUrl] = useState(""); // AGF-S2-12
  const [locationError, setLocationError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const serverErrors = useFieldErrors(); // AGF-S2-11
  const clearServerErrors = serverErrors.clear;

  useEffect(() => {
    if (!open) return;
    setName(business.name ?? "");
    setPhone(business.businessPhone ?? "");
    setAddress(business.streetAddress ?? "");
    setCity(business.city ?? "");
    setRegion(business.state ?? "");
    setZipcode(business.zipcode ?? "");
    setCurrency(displayCurrency(business.currency));
    setLocationUrl(business.locationUrl ?? "");
    setLocationError("");
    setError("");
    clearServerErrors();
  }, [open, business, clearServerErrors]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Business name is required"); return; }
    if (phone && !isValidEthiopianPhone(phone)) { setError("Enter a valid Ethiopian phone number"); return; }
    const locationProblem = googleMapsUrlProblem(locationUrl);
    setLocationError(locationProblem ?? "");
    if (locationProblem) return;
    // AGF-S2-12 (D-S2-12-P1): sent only when changed; "" removes the saved link
    const locationChanged = locationUrl.trim() !== (business.locationUrl ?? "");

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
        // AGF-S2-12: sent only when changed; "" removes the link (D-S2-12-P1)
        ...(locationChanged ? { locationUrl: locationUrl.trim() } : {}),
      });
      toast("Business profile updated");
      onSaved();
      onClose();
    } catch (err: any) {
      // AGF-S2-11: field errors under their fields; otherwise the server message
      setError(serverErrors.apply(err, {
        name: name.trim(), businessPhone: phone, streetAddress: address.trim(), city: city.trim(),
        state: region.trim(), zipcode: zipcode.trim(), currency, locationUrl: locationUrl.trim(),
      }, "Failed to update business profile") ?? "");
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
          error={serverErrors.errorFor("name", name.trim())}
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
          {serverErrors.errorFor("businessPhone", phone) && (
            <p className="mt-1 text-sm text-red-600">{serverErrors.errorFor("businessPhone", phone)}</p>
          )}
        </div>
        <FormInput
          label="Street Address"
          value={address}
          error={serverErrors.errorFor("streetAddress", address.trim())}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            label="City"
            value={city}
            error={serverErrors.errorFor("city", city.trim())}
            onChange={(e) => setCity(e.target.value)}
          />
          <FormInput
            label="Region"
            value={region}
            error={serverErrors.errorFor("state", region.trim())}
            placeholder="Addis Ababa, Oromia..."
            onChange={(e) => setRegion(e.target.value)}
          />
        </div>
        <FormInput
          label="Postal Code"
          value={zipcode}
          error={serverErrors.errorFor("zipcode", zipcode.trim())}
          onChange={(e) => setZipcode(e.target.value)}
        />

        {/* AGF-S2-02: one currency for all prices on this restaurant's menus */}
        <FormSelect label="Currency" value={currency} error={serverErrors.errorFor("currency", currency)} onChange={(e) => setCurrency(e.target.value)}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
          {!(SUPPORTED_CURRENCIES as readonly string[]).includes(displayCurrency(business.currency)) && (
            <option value={displayCurrency(business.currency)}>{displayCurrency(business.currency)} (current)</option>
          )}
        </FormSelect>
        {/* AGF-S2-12: the restaurant's Google Maps share link powers "Get Directions" on the guest menu */}
        <div className="space-y-1">
          <FormInput
            label="Google Maps link"
            placeholder="https://maps.app.goo.gl/…"
            value={locationUrl}
            maxLength={2048}
            error={locationError || serverErrors.errorFor("locationUrl", locationUrl.trim())}
            onChange={(e) => { setLocationUrl(e.target.value); setLocationError(""); }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <a href={GOOGLE_MAPS_FIND_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
              Find on Google Maps
            </a>
            {locationUrl && (
              <button type="button" className="font-medium text-red-600 hover:underline" onClick={() => { setLocationUrl(""); setLocationError(""); }}>
                Remove link
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">In Google Maps, open your restaurant, choose Share and paste the link here.</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} isLoading={saving}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}