import {useState} from "react";
import AuthLayout from "../../components/auth/AuthLayout";
import {Input} from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import WizardStepper from "../../components/wizard/WizardStepper";
import {useAuth} from "../../app/context/AuthContext";
import {useToast} from "../../components/ui/ToastContext";
import {useNavigate} from "react-router-dom";
import PhoneInput, {isValidPhoneNumber} from "react-phone-number-input";
import "react-phone-number-input/style.css";

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

// ----- Password Validation ------------------------------------------------
const validatePasswordStrength = (password: string) => {
    return {
        minLength: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        symbol: /[^A-Za-z0-9]/.test(password),
    };
};

const isStrongPassword = (password: string) => {
    const checks = validatePasswordStrength(password);
    return Object.values(checks).every(Boolean);
};

function PasswordStrength({password}: { password: string }) {
    const checks = validatePasswordStrength(password);

    const ruleClass = (valid: boolean) =>
        valid ? "text-green-600" : "text-gray-500";

    return (
        <div className="text-sm space-y-1 -mt-2">
            <p className={ruleClass(checks.minLength)}>
                {checks.minLength ? "✓" : "•"} At least 8 characters
            </p>

            <p className={ruleClass(checks.lowercase)}>
                {checks.lowercase ? "✓" : "•"} One lowercase letter
            </p>

            <p className={ruleClass(checks.uppercase)}>
                {checks.uppercase ? "✓" : "•"} One uppercase letter
            </p>

            <p className={ruleClass(checks.number)}>
                {checks.number ? "✓" : "•"} One number
            </p>

            <p className={ruleClass(checks.symbol)}>
                {checks.symbol ? "✓" : "•"} One symbol
            </p>
        </div>
    );
}

// ----- Ethiopia Phone Validation ------------------------------------------
const isValidEthiopianPhoneNumber = (phone?: string) => {
    if (!phone) return false;

    // Library validates phone number format.
    // startsWith("+251") makes sure only Ethiopian numbers are accepted.
    return phone.startsWith("+251") && isValidPhoneNumber(phone);
};

// ----- Tailwind Classes ----------------------------------------------------
const phoneInputClass =
    "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm " +
    "focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500";

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
                acc[d] = {enabled: false, start: "02:00", end: "11:00"};
                return acc;
            },
            {}
        ),
    },
    subdomain: "",
};

const steps = [{label: "Personal"}, {label: "Business"}, {label: "Hours"}];

export default function RegisterWizard() {
    const [step, setStep] = useState(0);
    const [data, setData] = useState<WizardState>(defaultState);
    const [error, setError] = useState<string>();
    const [submitting, setSubmitting] = useState(false);

    const {register, loading} = useAuth();
    const toast = useToast();
    const nav = useNavigate();

    // ---------- Validation --------------------------------------------------
    const validateStep = () => {
        if (step === 0) {
            const {fullName, email, phone, password, confirm} = data.personal;

            if (!fullName || !email || !password || !confirm) return false;
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;

            // Personal phone is optional.
            // But if entered, it must be a valid Ethiopian phone number.
            if (phone && !isValidEthiopianPhoneNumber(phone)) return false;

            if (!isStrongPassword(password) || password !== confirm) return false;

            return true;
        }

        if (step === 1) {
            const b = data.business;

            // Ethiopia backend required fields:
            if (!b.businessName || !b.businessPhone || !b.address || !b.city || !b.region) {
                return false;
            }

            // Business phone is required and must be Ethiopian.
            if (!isValidEthiopianPhoneNumber(b.businessPhone)) return false;

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
                phoneNumber: p.phone.trim() || undefined,
                password: p.password,

                // business
                businessName: b.businessName.trim(),
                businessPhone: b.businessPhone.trim(),
                streetAddress: b.address.trim(),
                city: b.city.trim(),

                // Region maps to backend "state"
                state: b.region.trim(),

                // optional Ethiopia details
                zipcode: b.postalCode.trim() || "",
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
                        startTime: v.enabled && v.start ? v.start : null,
                        endTime: v.enabled && v.end ? v.end : null,
                    })),
            };

            await register(payload);
            toast("Registration successful!");
            nav('/auth/login');
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Registration failed";
            toast(msg);
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // ---------- Helpers -----------------------------------------------------
    const update = (key: keyof WizardState, value: any) =>
        setData((d) => ({...d, [key]: value}));

    // ---------- Render ------------------------------------------------------
    const renderStep = () => {
        if (step === 0) {
            const p = data.personal;

            return (
                <div className="space-y-4">
                    <Input
                        label="Full Name *"
                        value={p.fullName}
                        onChange={(e) => update("personal", {...p, fullName: e.target.value})}
                    />

                    <Input
                        label="Email *"
                        type="email"
                        value={p.email}
                        onChange={(e) => update("personal", {...p, email: e.target.value})}
                    />

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Phone
                        </label>

                        <PhoneInput
                            international
                            defaultCountry="ET"
                            countries={["ET"]}
                            countryCallingCodeEditable={false}
                            value={p.phone}
                            onChange={(value) => update("personal", {...p, phone: value || ""})}
                            placeholder="Enter phone number"
                            className={phoneInputClass}
                        />

                        {p.phone && !isValidEthiopianPhoneNumber(p.phone) && (
                            <p className="text-sm text-red-600 mt-1">
                                Enter a valid Ethiopian phone number.
                            </p>
                        )}
                    </div>

                    <Input
                        label="Password *"
                        type="password"
                        value={p.password}
                        onChange={(e) => update("personal", {...p, password: e.target.value})}
                    />

                    <PasswordStrength password={p.password}/>

                    <Input
                        label="Confirm Password *"
                        type="password"
                        value={p.confirm}
                        onChange={(e) => update("personal", {...p, confirm: e.target.value})}
                    />

                    {p.confirm && p.password !== p.confirm && (
                        <p className="text-sm text-red-600 -mt-2">
                            Passwords do not match.
                        </p>
                    )}
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
                        onChange={(e) => update("business", {...b, businessName: e.target.value})}
                    />

                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Business Phone *
                        </label>

                        <PhoneInput
                            international
                            defaultCountry="ET"
                            countries={["ET"]}
                            countryCallingCodeEditable={false}
                            value={b.businessPhone}
                            onChange={(value) => update("business", {...b, businessPhone: value || ""})}
                            placeholder="Enter business phone number"
                            className={phoneInputClass}
                        />

                        {b.businessPhone && !isValidEthiopianPhoneNumber(b.businessPhone) && (
                            <p className="text-sm text-red-600 mt-1">
                                Enter a valid Ethiopian business phone number.
                            </p>
                        )}
                    </div>

                    <Input
                        label="Street Address *"
                        value={b.address}
                        onChange={(e) => update("business", {...b, address: e.target.value})}
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="City *"
                            value={b.city}
                            onChange={(e) => update("business", {...b, city: e.target.value})}
                        />

                        <Input
                            label="Region *"
                            value={b.region}
                            placeholder="Addis Ababa, Oromia, Amhara..."
                            onChange={(e) => update("business", {...b, region: e.target.value})}
                        />
                    </div>

                    <Input
                        label="Postal Code "
                        value={b.postalCode}
                        onChange={(e) => update("business", {...b, postalCode: e.target.value})}
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Sub-City "
                            value={b.subCity ?? ""}
                            onChange={(e) => update("business", {...b, subCity: e.target.value})}
                        />

                        <Input
                            label="Woreda "
                            value={b.woreda ?? ""}
                            onChange={(e) => update("business", {...b, woreda: e.target.value})}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Kebele "
                            value={b.kebele ?? ""}
                            onChange={(e) => update("business", {...b, kebele: e.target.value})}
                        />

                        <Input
                            label="House No. "
                            value={b.houseNumber ?? ""}
                            onChange={(e) => update("business", {...b, houseNumber: e.target.value})}
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
                        onChange={(e) => update("hours", {...h, open247: e.target.checked})}
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
                                    update("hours", {
                                        ...h,
                                        days: {
                                            ...h.days,
                                            [day]: {...val, enabled: e.target.checked},
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
                                        days: {
                                            ...h.days,
                                            [day]: {...val, start: e.target.value},
                                        },
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
                                        days: {
                                            ...h.days,
                                            [day]: {...val, end: e.target.value},
                                        },
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

                    <span className="mt-6 text-sm">.{import.meta.env.VITE_APP_DOMAIN ?? "agafarimenu.com"}</span>
                </div>
            </div>
        );
    };

    return (
        <AuthLayout>
            <div className="max-w-xl mx-auto">
                <WizardStepper steps={steps} current={step} completed={step}/>

                {error && (
                    <p className="bg-red-50 text-red-600 p-2 rounded mt-4">
                        {error}
                    </p>
                )}

                <div className="mt-6">{renderStep()}</div>

                <div className="mt-8 flex justify-between">
                    {step > 0 ? (
                        <Button variant="secondary" onClick={back} disabled={loading || submitting}>
                            Back
                        </Button>
                    ) : (
                        <span/>
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

                <p className="mt-6 text-center text-sm text-gray-500">
                    Already have an account?{" "}
                    <button
                        onClick={() => nav("/auth/login")}
                        className="font-semibold hover:underline"
                    >
                       <span className="text-brand">Log in</span>
                    </button>
                </p>
            </div>
        </AuthLayout>
    );
}