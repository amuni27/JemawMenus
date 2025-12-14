import { useState } from 'react';
import AuthLayout from '../../components/auth/AuthLayout';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import WizardStepper from '../../components/wizard/WizardStepper';
import { useAuth } from '../../app/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';

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
  start: string; // HH:MM
  end: string;   // HH:MM
}
interface BusinessHours {
  open247: boolean;
  days: Record<string, DayHours>; // mon..sun
}
interface WizardState {
  personal: PersonalInfo;
  business: BusinessInfo;
  hours: BusinessHours;
  subdomain: string;
}

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
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].reduce<Record<string, DayHours>>((acc, d) => {
      acc[d] = { enabled: true, start: '09:00', end: '17:00' };
      return acc;
    }, {}),
  },
  subdomain: '',
};

const steps = [
  { label: 'Personal' },
  { label: 'Business' },
  { label: 'Hours' },
];

export default function RegisterWizard() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardState>(defaultState);
  const { register, loading } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState<string | undefined>();

  // ---------- Validation helpers ------------------
  const validateStep = (): boolean => {
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
      if (!/^[a-z0-9-]+$/.test(data.subdomain.trim())) return false;
      return true;
    }
    return false;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, 2));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const complete = async () => {
    if (!validateStep()) return;
    try {
      const p = data.personal;
      const b = data.business;
      await register(p.email, p.password, b.businessName, `${b.address}, ${b.city}, ${b.state} ${b.zipcode}`, b.businessPhone);
      const tenant = await api.tenant.getTenantById(api.tenant.getTenantById ? (await api.tenant.getTenantById) : '');
      // fallback to login page
      nav('/auth/login');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ---------- Render helpers ------------------
  const update = (segment: keyof WizardState, value: any) =>
    setData((d) => ({ ...d, [segment]: value }));

  const renderStep = () => {
    if (step === 0) {
      const p = data.personal;
      return (
        <div className="space-y-4">
          <Input label="Full Name" value={p.fullName} onChange={(e) => update('personal', { ...p, fullName: e.target.value })} required />
          <Input label="Email" type="email" value={p.email} onChange={(e) => update('personal', { ...p, email: e.target.value })} required />
          <Input label="Phone Number" value={p.phone} onChange={(e) => update('personal', { ...p, phone: e.target.value })} required />
          <Input label="Password" type="password" value={p.password} onChange={(e) => update('personal', { ...p, password: e.target.value })} required />
          <Input label="Confirm Password" type="password" value={p.confirm} onChange={(e) => update('personal', { ...p, confirm: e.target.value })} required />
        </div>
      );
    }
    if (step === 1) {
      const b = data.business;
      return (
        <div className="space-y-4">
          <Input label="Business Name" value={b.businessName} onChange={(e) => update('business', { ...b, businessName: e.target.value })} required />
          <Input label="Business Phone" value={b.businessPhone} onChange={(e) => update('business', { ...b, businessPhone: e.target.value })} />
          <Input label="Street Address" value={b.address} onChange={(e) => update('business', { ...b, address: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={b.city} onChange={(e) => update('business', { ...b, city: e.target.value })} required />
            <Input label="State" value={b.state} onChange={(e) => update('business', { ...b, state: e.target.value })} required />
          </div>
          <Input label="Zipcode" value={b.zipcode} onChange={(e) => update('business', { ...b, zipcode: e.target.value })} required />
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
        {!h.open247 && (
          <div className="space-y-2">
            {Object.entries(h.days).map(([day, val]) => (
              <div key={day} className="flex items-center gap-3">
                <label className="w-16 text-sm">{day}</label>
                <input type="checkbox" checked={val.enabled} onChange={(e) => {
                  const v = { ...h.days[day], enabled: e.target.checked };
                  update('hours', { ...h, days: { ...h.days, [day]: v } });
                }} />
                <input type="time" value={val.start} disabled={!val.enabled} onChange={(e) => {
                  update('hours', { ...h, days: { ...h.days, [day]: { ...val, start: e.target.value } } });
                }} />
                <span>to</span>
                <input type="time" value={val.end} disabled={!val.enabled} onChange={(e) => update('hours', { ...h, days: { ...h.days, [day]: { ...val, end: e.target.value } } })} />
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            label="Custom Domain"
            placeholder="yourrestaurant"
            value={data.subdomain}
            onChange={(e) => setData((d) => ({ ...d, subdomain: e.target.value.toLowerCase() }))}
            required
          />
          <span className="mt-6 text-sm">.menuqrs.com</span>
        </div>
      </div>
    );
  };

  // ---------- UI ------------------
  return (
    <AuthLayout>
      <div className="max-w-xl mx-auto">
        <WizardStepper steps={steps} current={step} completed={step} />
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600 mb-4">{error}</p>}
        {renderStep()}
        <div className="mt-8 flex justify-between">
          {step > 0 ? (
            <Button variant="secondary" onClick={back} disabled={loading}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <Button onClick={next} disabled={!validateStep()}>
              Next
            </Button>
          ) : (
            <Button onClick={complete} isLoading={loading} disabled={!validateStep()}>
              Complete Signup
            </Button>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
