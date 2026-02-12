import { useState } from "react";
import AuthLayout from "../../components/auth/AuthLayout";
import { Input } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import WizardStepper from "../../components/wizard/WizardStepper";
import { useAuth } from "../../app/context/AuthContext";
import { useToast } from "../../components/ui/ToastContext";
import { useNavigate } from "react-router-dom";
import { delay } from "../../api/_utils.ts";

// ----- Types ---------------------------------------------------------------
interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string; // optional -> backend phoneNumber
  password: string;
  confirm: string;
}

interface BusinessInfo {
  businessName: string;
  businessPhone: string;

  address: string; // streetAddress
  city: string;
  region: string; // backend "state" (Region)
  postalCode: string; // backend "zipcode" optional

  // Optional Ethiopia details (backend accepts optional fields)
  subCity?: string;
  woreda?: string;
  kebele?: string;
  houseNumber?: string;
}

interface DayHours {
  enabled: boolean;
  start: string;
  end: string;
}

interface BusinessHours {
  open247: boolean;
  days: Record<string, DayHours>;
}

interface WizardState {
  personal: PersonalInfo;
  business: BusinessInfo;
  hours: BusinessHours;
  subdomain: string;
}

// ----- Day Mapping (CRITICAL) ---------------------------------------------
const DAY_MAP: Record<string, string> = {
  Mon: "MONDAY",
  Tue: "TUESDAY",
  Wed: "WEDNESDAY",
  Thu: "THURSDAY",
  Fri: "FRIDAY",
  Sat: "SATURDAY",
  Sun: "SUNDAY",
};

// ----- Default State ------------------------------------------------------
const defaultState: WizardState = {
  personal: {
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  },
  business: {
    businessName: "",
    businessPhone: "",
    address: "",
    city: "",
    region: "",
    postalCode: "",
    subCity: "",
    woreda: "",
    kebele: "",
    houseNumber: "",
  },
  hours: {
    open247: false,
    days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].reduce<Record<string, DayHours>>(
        (acc, d) => {
          acc[d] = { enabled: false, start: "02:00", end: "11:00" };
          return acc;
        },
        {}
    ),
  },
  subdomain: "",
};

const steps = [{ label: "Personal" }, { label: "Business" }, { label: "Hours" }];

export default function RegisterWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardState>(defaultState);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const { register, loading } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  // ---------- Validation --------------------------------------------------
  const validateStep = () => {
    if (step === 0) {
      const { fullName, email, password, confirm } = data.personal;

      if (!fullName || !email || !password || !confirm) return false;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
      if (password.length < 6 || password !== confirm) return false;

      // phone is optional
      return true;
    }

    if (step === 1) {
      const b = data.business;

      // Ethiopia backend required fields:
      if (!b.businessName || !b.businessPhone || !b.address || !b.city || !b.region) return false;

      // postalCode and other Ethiopia details are optional
      return true;
    }

    if (step === 2) {
      const sub = data.subdomain.trim().toLowerCase();
      // matches backend: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      return sub.length >= 3 && sub.length <= 30 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sub);
    }

    return false;
  };

  const next = () => validateStep() && setStep((s) => Math.min(s + 1, 2));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // ---------- Submit ------------------------------------------------------
  const complete = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setError(undefined);

    try {
      const p = data.personal;
      const b = data.business;
      const h = data.hours;

      const payload = {
        // user
        fullName: p.fullName.trim(),
        email: p.email.trim().toLowerCase(),
        phoneNumber: p.phone.trim() || undefined, // ✅ optional
        password: p.password,

        // business
        businessName: b.businessName.trim(),
        businessPhone: b.businessPhone.trim(),
        streetAddress: b.address.trim(),
        city: b.city.trim(),

        // ✅ Region maps to backend "state"
        state: b.region.trim(),

        // ✅ optional (Ethiopia)
        zipcode: b.postalCode.trim() || "",

        // ✅ optional Ethiopia details
        subCity: b.subCity?.trim() || undefined,
        woreda: b.woreda?.trim() || undefined,
        kebele: b.kebele?.trim() || undefined,
        houseNumber: b.houseNumber?.trim() || undefined,

        // subdomain
        customSubdomain: data.subdomain.trim().toLowerCase(),
        currency: "ETB",

        // hours
        open24_7: h.open247,
        businessHours: h.open247
            ? []
            : Object.entries(h.days).map(([day, v]) => ({
              dayOfWeek: DAY_MAP[day],
              isOpen: v.enabled,
              startTime: v.enabled ? v.start : null,
              endTime: v.enabled ? v.end : null,
            })),
      };

        console.log("payload ", payload)

      await register(payload);

      toast("Account created");
      await delay(700);
      nav("/auth/login");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Registration failed";
      toast(msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Helpers -----------------------------------------------------
  const update = (key: keyof WizardState, value: any) => setData((d) => ({ ...d, [key]: value }));

  // ---------- Render ------------------------------------------------------
  const renderStep = () => {
    if (step === 0) {
      const p = data.personal;
      return (
          <div className="space-y-4">
            <Input
                label="Full Name *"
                value={p.fullName}
                onChange={(e) => update("personal", { ...p, fullName: e.target.value })}
            />

            <Input
                label="Email *"
                type="email"
                value={p.email}
                onChange={(e) => update("personal", { ...p, email: e.target.value })}
            />

            <Input
                label="Phone "
                type="tel"
                value={p.phone}
                onChange={(e) => update("personal", { ...p, phone: e.target.value })}
            />

            <Input
                label="Password *"
                type="password"
                value={p.password}
                onChange={(e) => update("personal", { ...p, password: e.target.value })}
            />

            <Input
                label="Confirm Password *"
                type="password"
                value={p.confirm}
                onChange={(e) => update("personal", { ...p, confirm: e.target.value })}
            />
          </div>
      );
    }

    if (step === 1) {
      const b = data.business;
      return (
          <div className="space-y-4">
            <Input
                label="Business Name *"
                value={b.businessName}
                onChange={(e) => update("business", { ...b, businessName: e.target.value })}
            />

            <Input
                label="Business Phone *"
                value={b.businessPhone}
                onChange={(e) => update("business", { ...b, businessPhone: e.target.value })}
            />

            <Input
                label="Street Address *"
                value={b.address}
                onChange={(e) => update("business", { ...b, address: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                  label="City *"
                  value={b.city}
                  onChange={(e) => update("business", { ...b, city: e.target.value })}
              />

              <Input
                  label="Region *"
                  value={b.region}
                  placeholder="Addis Ababa, Oromia, Amhara..."
                  onChange={(e) => update("business", { ...b, region: e.target.value })}
              />
            </div>

            <Input
                label="Postal Code "
                value={b.postalCode}
                onChange={(e) => update("business", { ...b, postalCode: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                  label="Sub-City "
                  value={b.subCity ?? ""}
                  onChange={(e) => update("business", { ...b, subCity: e.target.value })}
              />
              <Input
                  label="Woreda "
                  value={b.woreda ?? ""}
                  onChange={(e) => update("business", { ...b, woreda: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                  label="Kebele "
                  value={b.kebele ?? ""}
                  onChange={(e) => update("business", { ...b, kebele: e.target.value })}
              />
              <Input
                  label="House No. "
                  value={b.houseNumber ?? ""}
                  onChange={(e) => update("business", { ...b, houseNumber: e.target.value })}
              />
            </div>
          </div>
      );
    }

    const h = data.hours;
    return (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
                type="checkbox"
                checked={h.open247}
                onChange={(e) => update("hours", { ...h, open247: e.target.checked })}
            />
            Open 24/7
          </label>

          {!h.open247 &&
              Object.entries(h.days).map(([day, val]) => (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-14">{day}</span>
                      <input
                          type="checkbox"
                          checked={val.enabled}
                          onChange={(e) => {
                              const enabled = e.target.checked;
                              console.log("isOpen",enabled)

                              update("hours", {
                                  ...h,
                                  days: {
                                      ...h.days,
                                      [day]: enabled
                                          ? {...val, enabled: true}
                                          : {enabled: false, start: "", end: ""}, // reset times when closed
                                  },
                              });
                          }}
                      />
                      <input
                          type="time"
                          value={val.start}
                          disabled={!val.enabled}
                          onChange={(e) =>
                              update("hours", {
                                  ...h,
                                  days: {...h.days, [day]: {...val, start: e.target.value } },
                            })
                        }
                    />
                    <span>to</span>
                    <input
                        type="time"
                        value={val.end}
                        disabled={!val.enabled}
                        onChange={(e) =>
                            update("hours", {
                              ...h,
                              days: { ...h.days, [day]: { ...val, end: e.target.value } },
                            })
                        }
                    />
                  </div>
              ))}

          <div className="flex items-center gap-2">
            <Input
                label="Choose your subdomain *"
                value={data.subdomain}
                placeholder="your-restaurant"
                onChange={(e) => update("subdomain", e.target.value.toLowerCase())}
            />
            <span className="mt-6 text-sm">.menuqrs.com</span>
          </div>
        </div>
    );
  };

  return (
      <AuthLayout>
        <div className="max-w-xl mx-auto">
          <WizardStepper steps={steps} current={step} completed={step} />

          {error && <p className="bg-red-50 text-red-600 p-2 rounded mt-4">{error}</p>}

          <div className="mt-6">{renderStep()}</div>

          <div className="mt-8 flex justify-between">
            {step > 0 ? (
                <Button variant="secondary" onClick={back} disabled={loading || submitting}>
                  Back
                </Button>
            ) : (
                <span />
            )}

            {step < 2 ? (
                <Button onClick={next} disabled={!validateStep() || loading || submitting}>
                  Next
                </Button>
            ) : (
                <Button onClick={complete} isLoading={submitting} disabled={!validateStep() || loading}>
                  Complete Signup
                </Button>
            )}
          </div>
        </div>
      </AuthLayout>
  );
}
