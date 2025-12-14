import { useState } from 'react';
import AuthLayout from '../../components/auth/AuthLayout';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import WizardStepper from '../../components/wizard/WizardStepper';
import { useAuth } from '../../app/context/AuthContext';
import { useToast } from '../../components/ui/ToastContext';
import { useNavigate } from 'react-router-dom';
import {register} from '../../services/authService.ts'

// ----- Types ---------------------------------------------------------------
interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
}
interface BusinessInfo {
  businessName: string;
  businessPhone: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
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
  Mon: 'MONDAY',
  Tue: 'TUESDAY',
  Wed: 'WEDNESDAY',
  Thu: 'THURSDAY',
  Fri: 'FRIDAY',
  Sat: 'SATURDAY',
  Sun: 'SUNDAY',
};

// ----- Default State ------------------------------------------------------
const defaultState: WizardState = {
  personal: {
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  },
  business: {
    businessName: '',
    businessPhone: '',
    address: '',
    city: '',
    state: '',
    zipcode: '',
  },
  hours: {
    open247: false,
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].reduce<
        Record<string, DayHours>
    >((acc, d) => {
      acc[d] = { enabled: true, start: '09:00', end: '17:00' };
      return acc;
    }, {}),
  },
  subdomain: '',
};

const steps = [{ label: 'Personal' }, { label: 'Business' }, { label: 'Hours' }];

export default function RegisterWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardState>(defaultState);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const { login, loading } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  // ---------- Validation --------------------------------------------------
  const validateStep = () => {
    if (step === 0) {
      const { fullName, email, phone, password, confirm } = data.personal;
      if (!fullName || !email || !phone || !password || !confirm) return false;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
      if (password.length < 6 || password !== confirm) return false;
      return true;
    }
    if (step === 1) {
      const { businessName, address, city, state, zipcode } = data.business;
      if (!businessName || !address || !city || !state || !zipcode) return false;
      if (!/^[0-9]{5}(?:-[0-9]{4})?$/.test(zipcode)) return false;
      return true;
    }
    if (step === 2) {
      return /^[a-z0-9-]+$/.test(data.subdomain.trim());
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
      const payload = {
        fullName: data.personal.fullName.trim(),
        email: data.personal.email.trim().toLowerCase(),
        phoneNumber: data.personal.phone.trim(),
        password: data.personal.password,

        businessName: data.business.businessName.trim(),
        businessPhone: data.business.businessPhone.trim(),
        streetAddress: data.business.address.trim(),
        city: data.business.city.trim(),
        state: data.business.state.trim().toUpperCase(),
        zipcode: data.business.zipcode.trim(),
        customSubdomain: data.subdomain.trim().toLowerCase(),

        open24_7: data.hours.open247,
        businessHours: data.hours.open247
            ? []
            : Object.entries(data.hours.days).map(([day, v]) => ({
              dayOfWeek: DAY_MAP[day],
              isOpen: v.enabled,
              startTime: v.enabled ? v.start : null,
              endTime: v.enabled ? v.end : null,
            })),
      };

      const res = await register(payload)


      const json = await res.data;
      console.log(json)
      if (res.status !== 201) throw new Error(json.message || 'Registration failed');

      localStorage.setItem('token', json.token);
      toast('Account created');

      await login(payload.email, data.personal.password);
      nav('/');
    } catch (err: any) {
      toast(err.message || 'Registration failed');
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Helpers -----------------------------------------------------
  const update = (key: keyof WizardState, value: any) =>
      setData((d) => ({ ...d, [key]: value }));

  // ---------- Render ------------------------------------------------------
  const renderStep = () => {
    if (step === 0) {
      const p = data.personal;
      return (
          <div className="space-y-4">
            <Input label="Full Name" value={p.fullName} onChange={(e) => update('personal', { ...p, fullName: e.target.value })} />
            <Input label="Email" value={p.email} onChange={(e) => update('personal', { ...p, email: e.target.value })} />
            <Input label="Phone" value={p.phone} onChange={(e) => update('personal', { ...p, phone: e.target.value })} />
            <Input label="Password" type="password" value={p.password} onChange={(e) => update('personal', { ...p, password: e.target.value })} />
            <Input label="Confirm Password" type="password" value={p.confirm} onChange={(e) => update('personal', { ...p, confirm: e.target.value })} />
          </div>
      );
    }

    if (step === 1) {
      const b = data.business;
      return (
          <div className="space-y-4">
            <Input label="Business Name" value={b.businessName} onChange={(e) => update('business', { ...b, businessName: e.target.value })} />
            <Input label="Business Phone" value={b.businessPhone} onChange={(e) => update('business', { ...b, businessPhone: e.target.value })} />
            <Input label="Street Address" value={b.address} onChange={(e) => update('business', { ...b, address: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="City" value={b.city} onChange={(e) => update('business', { ...b, city: e.target.value })} />
              <Input label="State" value={b.state} onChange={(e) => update('business', { ...b, state: e.target.value })} />
            </div>
            <Input label="Zipcode" value={b.zipcode} onChange={(e) => update('business', { ...b, zipcode: e.target.value })} />
          </div>
      );
    }

    const h = data.hours;
    return (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={h.open247} onChange={(e) => update('hours', { ...h, open247: e.target.checked })} />
            Open 24/7
          </label>

          {!h.open247 &&
              Object.entries(h.days).map(([day, val]) => (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-14">{day}</span>
                    <input type="checkbox" checked={val.enabled} onChange={(e) => update('hours', { ...h, days: { ...h.days, [day]: { ...val, enabled: e.target.checked } } })} />
                    <input type="time" value={val.start} disabled={!val.enabled} onChange={(e) => update('hours', { ...h, days: { ...h.days, [day]: { ...val, start: e.target.value } } })} />
                    <span>to</span>
                    <input type="time" value={val.end} disabled={!val.enabled} onChange={(e) => update('hours', { ...h, days: { ...h.days, [day]: { ...val, end: e.target.value } } })} />
                  </div>
              ))}

          <div className="flex items-center gap-2">
            <Input label="Custom Domain" value={data.subdomain} onChange={(e) => update('subdomain', e.target.value.toLowerCase())} />
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
            {step > 0 ? <Button variant="secondary" onClick={back} disabled={loading}>Back</Button> : <span />}
            {step < 2 ? (
                <Button onClick={next} disabled={!validateStep()}>Next</Button>
            ) : (
                <Button onClick={complete} isLoading={submitting} disabled={!validateStep()}>
                  Complete Signup
                </Button>
            )}
          </div>
        </div>
      </AuthLayout>
  );
}
