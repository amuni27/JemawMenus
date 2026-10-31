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
import {
  CITY_MESSAGE, LINK_KEEP_MESSAGE, STATE_MESSAGE, STREET_MESSAGE, US_STATES, ZIP_MESSAGE, countryName, countryOf,
  isUsState, isUsZip, phoneMatchesCountry, phoneMessage, usZipProblem,
} from "../../utils/countryRules";
import { US_TIME_ZONES, US_ZONE_MESSAGE, isUsZone } from "../../utils/timeZones";
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

// AGF-S2-12 CR1: the phone must belong to the restaurant's country (D-CR1-3)
const isValidPhone = (country: "ET" | "US", p?: string) =>
  !p || (phoneMatchesCountry(country, p) && isValidPhoneNumber(p));

export default function BusinessProfileModal({ open, onClose, business, onSaved }: Props) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [timeZone, setTimeZone] = useState(""); // AGF-S2-26 (US only)
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [locationUrl, setLocationUrl] = useState(""); // AGF-S2-12
  const [locationError, setLocationError] = useState("");
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({}); // AGF-S2-12 CR1 (US)
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
    setTimeZone(isUsZone(business.timeZone) ? business.timeZone! : "");
    setCurrency(displayCurrency(business.currency));
    setLocationUrl(business.locationUrl ?? "");
    setLocationError("");
    setAddressErrors({});
    setError("");
    clearServerErrors();
  }, [open, business, clearServerErrors]);

  // AGF-S2-12 CR1: the stored country decides the fields; it can't be changed here (D-CR1-4)
  const country = countryOf(business.country);
  const us = country === "US";
  // D-CR1-5: an Ethiopian restaurant may replace its saved link but not remove it
  const linkMustStay = !us && !!business.locationUrl;

  const handleSave = async () => {
    if (!name.trim()) { setError("Business name is required"); return; }
    if (phone && !isValidPhone(country, phone)) { setError(phoneMessage(country)); return; }
    const locationProblem = googleMapsUrlProblem(locationUrl) ?? (linkMustStay && !locationUrl.trim() ? LINK_KEEP_MESSAGE : null);
    setLocationError(locationProblem ?? "");
    const problems: Record<string, string> = {};
    if (us) {
      if (!address.trim()) problems.streetAddress = STREET_MESSAGE;
      if (!city.trim()) problems.city = CITY_MESSAGE;
      if (!isUsState(region)) problems.state = STATE_MESSAGE;
      if (!isUsZip(zipcode)) problems.zipcode = ZIP_MESSAGE;
      if (!isUsZone(timeZone)) problems.timeZone = US_ZONE_MESSAGE;
    }
    setAddressErrors(problems);
    if (locationProblem || Object.keys(problems).length > 0) return;
    // AGF-S2-12 (D-S2-12-P1): sent only when changed; "" removes the saved link
    const locationChanged = locationUrl.trim() !== (business.locationUrl ?? "");

    setSaving(true);
    setError("");
    try {
      await profileApi.updateBusiness(business.id, {
        name: name.trim(),
        businessPhone: phone || undefined,
        // AGF-S2-12 CR1: address fields only for the United States (Ethiopia doesn't collect them)
        ...(us ? { streetAddress: address.trim(), city: city.trim(), state: region.trim().toUpperCase(), zipcode: zipcode.trim() } : {}),
        // AGF-S2-26: US only, sent only when changed
        ...(us && timeZone !== business.timeZone ? { timeZone } : {}),
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
            defaultCountry={country}
            countries={[country]}
            countryCallingCodeEditable={false}
            value={phone}
            onChange={(v) => setPhone(v || "")}
            className={phoneInputClass}
          />
          {phone && !isValidPhone(country, phone) && (
            <p className="mt-1 text-sm text-red-600">{phoneMessage(country)}</p>
          )}
          {serverErrors.errorFor("businessPhone", phone) && (
            <p className="mt-1 text-sm text-red-600">{serverErrors.errorFor("businessPhone", phone)}</p>
          )}
        </div>
        {/* AGF-S2-12 CR1: read-only; the location fields below follow it */}
        <div>
          <p className="text-sm font-medium text-gray-700">Country</p>
          <p className="mt-1 text-sm text-gray-900">{countryName(country)}</p>
        </div>
        {us && (
          <>
            <FormInput
              label="Street Address"
              value={address}
              error={addressErrors.streetAddress || serverErrors.errorFor("streetAddress", address.trim())}
              onChange={(e) => setAddress(e.target.value)}
            />
            <FormInput
              label="City"
              value={city}
              error={addressErrors.city || serverErrors.errorFor("city", city.trim())}
              onChange={(e) => setCity(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormSelect
                label="State"
                value={region.trim().toUpperCase()}
                error={addressErrors.state || serverErrors.errorFor("state", region.trim())}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="">Select a state</option>
                {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </FormSelect>
              <FormInput
                label="ZIP Code"
                value={zipcode}
                inputMode="numeric"
                maxLength={10}
                error={addressErrors.zipcode || usZipProblem(zipcode) || serverErrors.errorFor("zipcode", zipcode.trim())}
                onChange={(e) => setZipcode(e.target.value)}
              />
            </div>
            <FormSelect
              label="Time zone"
              value={timeZone}
              error={addressErrors.timeZone || serverErrors.errorFor("timeZone", timeZone)}
              onChange={(e) => setTimeZone(e.target.value)}
            >
              <option value="">Select a time zone</option>
              {US_TIME_ZONES.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
            </FormSelect>
          </>
        )}

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
            {locationUrl && !linkMustStay && (
              <button type="button" className="font-medium text-red-600 hover:underline" onClick={() => { setLocationUrl(""); setLocationError(""); }}>
                Remove link
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {!us && !business.locationUrl && "Required for restaurants in Ethiopia. "}
            In Google Maps, open your restaurant, choose Share and paste the link here.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} isLoading={saving}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}