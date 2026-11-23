import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminApi, type MonetizationModel, type PlanPriceVersion, type PriceInterval, type PriceMarket } from '../../api/adminApi';
import Modal from '../../components/ui/Modal';
import ModalHeader from '../../components/ui/ModalHeader';
import { errorMessage } from '../../utils/errorMessage';
import { PRIMARY, SECONDARY } from './consoleButtons';

// AGF SA-P1 (register §88, Route C): paid-plan prices over the existing SUB-R3-01 API. Versions are never edited or deleted: a new
// version is added inactive and activated separately (activation adds an active copy). The currency follows the market (the
// approved rule); intervals are monthly or yearly. Owners see prices only where the market's price display is on; nothing here
// charges anyone or turns on payment. The backend validates everything again and stays the authority on the amount.

const PAID_PLANS: { code: MonetizationModel; name: string }[] = [
  { code: 'MODEL_3', name: 'Model 3 · Business Ads' },
  { code: 'MODEL_4', name: 'Model 4 · Ad-Free' },
];
const MARKETS: { code: PriceMarket; currency: string }[] = [{ code: 'US', currency: 'USD' }, { code: 'ET', currency: 'ETB' }];
const INTERVALS: { code: PriceInterval; label: string }[] = [{ code: 'MONTH', label: 'Monthly' }, { code: 'YEAR', label: 'Yearly' }];

const planName = (code: string) => PAID_PLANS.find((p) => p.code === code)?.name ?? code;
const intervalLabel = (code: string) => INTERVALS.find((i) => i.code === code)?.label ?? code;
const money = (minor: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);

type Status = 'In effect' | 'Active (replaced)' | 'Scheduled' | 'Not active';

/** The same rule as the backend: per plan, market and interval, the highest active version already valid is in effect. */
function statuses(rows: PlanPriceVersion[], now: number): Map<string, Status> {
  const current = new Map<string, PlanPriceVersion>();
  for (const r of rows) {
    if (!r.active || Date.parse(r.validFrom) > now) continue;
    const key = `${r.planCode}|${r.market}|${r.interval}`;
    const best = current.get(key);
    if (!best || r.version > best.version) current.set(key, r);
  }
  const out = new Map<string, Status>();
  for (const r of rows) {
    if (!r.active) out.set(r.id, 'Not active');
    else if (Date.parse(r.validFrom) > now) out.set(r.id, 'Scheduled');
    else out.set(r.id, current.get(`${r.planCode}|${r.market}|${r.interval}`)?.id === r.id ? 'In effect' : 'Active (replaced)');
  }
  return out;
}

/** Main units ("25", "25.5", "25.50") to minor units; null with a message when it isn't a positive amount with ≤ 2 decimals. */
function toMinor(text: string): { minor: number } | { error: string } {
  const t = text.trim();
  if (!t) return { error: 'Enter an amount.' };
  if (/^-/.test(t)) return { error: 'Enter an amount above zero.' };
  if (!/^\d+(\.\d+)?$/.test(t)) return { error: 'Enter an amount, like 25.00.' };
  const [whole, frac = ''] = t.split('.');
  if (frac.length > 2) return { error: 'Use at most two decimal places.' };
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) return { error: 'Enter an amount, like 25.00.' };
  if (minor <= 0) return { error: 'Enter an amount above zero.' };
  return { minor };
}

function serverMessage(err: unknown, fallback: string): string {
  const fields = (err as { response?: { data?: { fieldErrors?: { field?: string; message?: string }[] } } })?.response?.data?.fieldErrors;
  if (Array.isArray(fields) && fields.length) return fields.map((f) => f.message).filter(Boolean).join(' ');
  return errorMessage(err, fallback);
}

export default function SuperAdminPrices() {
  const [rows, setRows] = useState<PlanPriceVersion[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [plan, setPlan] = useState<MonetizationModel | ''>('');
  const [market, setMarket] = useState<PriceMarket | ''>('');
  const [interval, setInterval] = useState<PriceInterval | ''>('');
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [formError, setFormError] = useState('');
  const [amountInvalid, setAmountInvalid] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<PlanPriceVersion | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(() => adminApi.prices().then((res) => { setRows(res.data); setLoadError(''); },
    (err) => setLoadError(errorMessage(err, "Couldn't load the prices."))), []);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice('');
    if (!plan || !market || !interval) {
      setAmountInvalid(false);
      setFormError('Choose a plan, a market and a billing interval.');
      return;
    }
    const parsed = toMinor(amount);
    if ('error' in parsed) {
      setAmountInvalid(true);
      setFormError(parsed.error);
      return;
    }
    setAmountInvalid(false);
    setFormError('');
    setBusy(true);
    try {
      await adminApi.createPrice({ planCode: plan, market, interval, amountMinor: parsed.minor, providerPriceRef: ref.trim() || null,
        validFrom: validFrom ? new Date(validFrom).toISOString() : null });
      setNotice('Version added. Activate it to make it the price in effect.');
      setAmount('');
      setRef('');
      setValidFrom('');
      await load();
    } catch (err) {
      setFormError(serverMessage(err, "Couldn't add the version."));
    } finally {
      setBusy(false);
    }
  };

  const activate = async (row: PlanPriceVersion) => {
    setBusy(true);
    try {
      await adminApi.activatePrice(row.id);
      setActionError('');
      await load();
    } catch (err) {
      setActionError(serverMessage(err, "Couldn't activate the version."));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const state = rows ? statuses(rows, Date.now()) : new Map<string, Status>();
  const currency = MARKETS.find((m) => m.code === market)?.currency;
  const describe = (r: PlanPriceVersion) => `${planName(r.planCode)}, ${r.market}, ${intervalLabel(r.interval).toLowerCase()}: ${money(r.amountMinor, r.currency)}`;

  return (
    <section className="space-y-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Plan prices</h1>
        <p className="mt-1 text-sm text-gray-600">
          Prices for paid plans, per market. The currency follows the market (US: USD, ET: ETB). Versions are never changed: add a new
          version, then activate it. Owners see prices only where the market's price display is on; nothing here charges anyone.
        </p>
      </div>

      {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
      {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
      {!loadError && !rows && <p className="text-sm text-gray-500">Loading…</p>}
      {rows && rows.length === 0 && <p className="text-sm text-gray-700">No prices yet. Owners see “Price not available” for every paid plan.</p>}
      {rows && rows.length > 0 && (
        <div role="region" aria-label="Price versions (scrolls sideways)" tabIndex={0}
             className="overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
          <table aria-label="Price versions" className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-600">
                {['Plan', 'Market', 'Interval', 'Amount', 'Version', 'Status', 'Valid from', 'Stripe price ID'].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-4 font-semibold">{h}</th>
                ))}
                <th scope="col" className="py-2 pr-4 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-price-id={r.id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">{planName(r.planCode)}</td>
                  <td className="py-2 pr-4">{r.market}</td>
                  <td className="py-2 pr-4">{intervalLabel(r.interval)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{money(r.amountMinor, r.currency)}</td>
                  <td className="py-2 pr-4">{r.version}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{state.get(r.id)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.validFrom).toLocaleString()}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{r.providerPriceRef || '—'}</td>
                  <td className="py-2 pr-4">
                    {!r.active && (
                      <button type="button" className={SECONDARY} disabled={busy} onClick={() => setConfirm(r)}
                              aria-label={`Activate ${planName(r.planCode)} ${r.market} ${intervalLabel(r.interval).toLowerCase()} version ${r.version}`}>
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form aria-label="Add a price version" noValidate onSubmit={submit} className="space-y-4 rounded-xl border border-gray-200 p-4">
        <h2 className="text-base font-semibold text-gray-900">Add a price version</h2>
        <div>
          <label htmlFor="price-plan" className="block text-sm font-medium text-gray-900">Plan</label>
          <select id="price-plan" value={plan} onChange={(e) => setPlan(e.target.value as MonetizationModel)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-72">
            <option value="">Choose a plan</option>
            {PAID_PLANS.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-gray-900">Market</legend>
          <div className="mt-1 flex gap-4 text-sm">
            {MARKETS.map((m) => (
              <label key={m.code} className="flex items-center gap-2">
                <input type="radio" name="price-market" value={m.code} checked={market === m.code} onChange={() => setMarket(m.code)} />
                {m.code} ({m.currency})
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-gray-900">Billing interval</legend>
          <div className="mt-1 flex gap-4 text-sm">
            {INTERVALS.map((i) => (
              <label key={i.code} className="flex items-center gap-2">
                <input type="radio" name="price-interval" value={i.code} checked={interval === i.code} onChange={() => setInterval(i.code)} />
                {i.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="price-amount" className="block text-sm font-medium text-gray-900">Amount{currency ? ` (${currency})` : ''}</label>
          <input id="price-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)}
                 aria-invalid={amountInvalid ? true : undefined} aria-describedby={formError ? 'price-form-error' : undefined}
                 className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-48" placeholder="25.00" />
          {currency && <p className="mt-1 text-xs text-gray-600">Currency: {currency}</p>}
        </div>
        <div>
          <label htmlFor="price-ref" className="block text-sm font-medium text-gray-900">Stripe price ID (optional)</label>
          <input id="price-ref" autoComplete="off" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="price_…"
                 className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm sm:w-96" />
        </div>
        <div>
          <label htmlFor="price-from" className="block text-sm font-medium text-gray-900">Valid from (optional; blank means now)</label>
          <input id="price-from" type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)}
                 className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-64" />
        </div>
        {formError && <p id="price-form-error" role="alert" className="text-sm text-red-700">{formError}</p>}
        {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
        <button type="submit" className={PRIMARY} disabled={busy}>{busy ? 'Saving…' : 'Add version'}</button>
      </form>

      <Modal open={confirm !== null} onClose={() => !busy && setConfirm(null)} className="max-w-md">
        {confirm && (
          <div role="dialog" aria-modal="true" aria-label="Activate this price?">
            <ModalHeader title="Activate this price?" onClose={() => !busy && setConfirm(null)} />
            <p className="text-sm text-gray-800">{describe(confirm)} (version {confirm.version}).</p>
            <p className="mt-3 text-sm text-gray-800">
              It becomes the price in effect from its start date. Owners see it only where the market's price display is on. It doesn't charge anyone or turn on payment.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className={SECONDARY} onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
              <button type="button" className={PRIMARY} disabled={busy} onClick={() => activate(confirm)}>{busy ? 'Activating…' : 'Activate'}</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
