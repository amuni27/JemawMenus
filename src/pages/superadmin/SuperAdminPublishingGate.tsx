import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import { errorMessage } from '../../utils/errorMessage';
import {
  adminApi, type PublishGateMarket, type PublishGatePage, type PublishGateRow, type PublishGateSection, type PublishGateSignOffResult,
  type PublishGateSummary,
} from '../../api/adminApi';

// AGF FE-4 (register §56–§58): the Super Admin reviews the read-only publishing-gate dry run (BE-6) per market and signs off
// exactly the reviewed report (U-1: the fingerprint at review start is re-checked before the dialog opens, and again by the
// server). The page reads the report, downloads the CSV and posts the sign-off; it never turns the gate or anything else on.

const PAGE_SIZE = 100; // U-5
const VALIDITY_DAYS = 14; // BE-6 D-3
const MARKETS: { value: PublishGateMarket; label: string }[] = [
  { value: 'ET', label: 'Ethiopia (ET)' },
  { value: 'US', label: 'United States (US)' },
];
const SECTIONS: { value: PublishGateSection; label: string; countKey: keyof PublishGateSummary['counts'] }[] = [
  { value: 'EXEMPT', label: 'Exempt', countKey: 'exempt' },
  { value: 'ALLOWED', label: 'Allowed', countKey: 'allowed' },
  { value: 'BLOCKED', label: 'Blocked', countKey: 'blocked' },
  { value: 'PUBLISHED_WITHOUT_PLAN', label: 'Published menus without a plan', countKey: 'publishedWithoutPlan' },
  { value: 'REVIEW', label: 'Needs review', countKey: 'review' },
  { value: 'NOT_GATED', label: 'Not gated', countKey: 'notGated' },
];
// U-4: these must be opened (when not empty) before signing off
const MUST_OPEN: PublishGateSection[] = ['BLOCKED', 'PUBLISHED_WITHOUT_PLAN', 'REVIEW'];

const BLOCKERS: Record<string, string> = {
  CUT_OVER_NOT_CONFIGURED: 'Cut-over date not configured',
  MONETIZATION_NOT_CONFIGURED: 'Monetization not configured',
  OWNER_PLANS_HIDDEN: 'Owner plans are hidden',
};
const REASONS: Record<string, string> = {
  NO_PLAN: 'No plan', PLAN_ENDED: 'Plan ended', CANCELLATION_DUE: 'Cancellation took effect', TRIAL_ENDED: 'Trial ended',
  GRACE_ENDED: 'Grace period ended', GRANDFATHERING_ENDED: 'Grandfathering ended', PERIOD_END_PASSED: 'Period ended',
  PROVIDER_WITHOUT_PERIOD: 'Paid plan without a period', STORED_EXPIRED: 'Expired', TRIAL: 'Free trial',
  ACTIVE_MANUAL: 'Active (manual record)', ACTIVE_OWNER: 'Active (started by the owner)', ACTIVE_PROVIDER: 'Active (paid)',
  GRANDFATHERED: 'Grandfathered', PAST_DUE_IN_GRACE: 'Payment overdue, in grace', DOWNGRADE_DUE: 'Downgrade took effect',
  NOT_GATED: 'Not gated',
};
const FLAGS: Record<string, string> = {
  OWNER_INACTIVE: 'Owner inactive', OWNER_MISSING: 'Owner missing', CREATED_AT_UNKNOWN: 'Creation date unknown',
  ENTITLED_ONLY_BECAUSE_PERIOD_END_OFF: 'Allowed only because period-end is off', PERIOD_END_MISSING: 'Period end missing',
  LEGACY_TRIAL_INTENT: 'Pending trial from before explicit trials', ACTIVE_PRIVATE_MENU: 'Has an active private menu',
  EVALUATION_ERROR: "Couldn't evaluate",
};
const SECTION_NAMES: Record<string, string> = { EXEMPT: 'Exempt', BLOCKED: 'Blocked', EVALUATION_ERROR: "Couldn't evaluate" };

const words = (map: Record<string, string>, code?: string) => (code ? map[code] ?? code : '');
const onOff = (on: boolean) => (on ? 'On' : 'Off');
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const joinList = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const sectionLabel = (s: PublishGateSection) => SECTIONS.find((x) => x.value === s)?.label ?? s;

type ApiFailure = { response?: { status?: number; data?: { code?: string } }; code?: string; message?: string };

function signOffError(err: unknown): string {
  const f = (err ?? {}) as ApiFailure;
  const status = f.response?.status;
  if (status === 409 && f.response?.data?.code === 'DRY_RUN_CHANGED') return 'The report changed just now. Refresh and review again.';
  if (status === 409) return errorMessage(err, 'The dry run has blockers.');
  if (status === 401) return 'Your admin session ended. Sign in again.';
  if (status === 403) return "Your account can't sign off.";
  if (!f.response && (f.code === 'ERR_NETWORK' || f.message === 'Network Error')) return "Couldn't reach the server; nothing was signed.";
  return errorMessage(err, "Couldn't sign off. Nothing was signed.");
}

export default function SuperAdminPublishingGate() {
  const [market, setMarket] = useState<PublishGateMarket>('ET');
  const [summary, setSummary] = useState<PublishGateSummary | null>(null);
  const [reviewed, setReviewed] = useState<string | null>(null); // the fingerprint this review started with (U-1)
  const [opened, setOpened] = useState<PublishGateSection[]>([]);
  const [section, setSection] = useState<PublishGateSection | null>(null);
  const [rows, setRows] = useState<PublishGatePage | null>(null);
  const [loadError, setLoadError] = useState('');
  const [problem, setProblem] = useState(''); // freshness, sign-off and download refusals
  const [result, setResult] = useState<PublishGateSignOffResult | null>(null);
  const [download, setDownload] = useState('');
  const [dialog, setDialog] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const returnFocus = useRef(false);

  const startReview = useCallback((s: PublishGateSummary) => {
    setSummary(s);
    setReviewed(s.fingerprint);
    setOpened([]);
    setSection(null);
    setRows(null);
  }, []);

  const load = useCallback(async (m: PublishGateMarket) => {
    setLoadError('');
    try {
      startReview((await adminApi.publishGateSummary(m)).data);
    } catch (err) {
      setLoadError(errorMessage(err, "Couldn't load the dry run."));
    }
  }, [startReview]);

  useEffect(() => {
    setSummary(null);
    setResult(null);
    setProblem('');
    setDownload('');
    load(market);
  }, [market, load]);

  useEffect(() => {
    if (!dialog && returnFocus.current) {
      returnFocus.current = false;
      trigger.current?.focus();
    }
  }, [dialog]);

  const refresh = async () => {
    setProblem('');
    try {
      const fresh = (await adminApi.publishGateSummary(market)).data;
      if (fresh.fingerprint === reviewed) setSummary(fresh); // same report: the review stands
      else startReview(fresh);
    } catch (err) {
      setLoadError(errorMessage(err, "Couldn't load the dry run."));
    }
  };

  const openSection = async (s: PublishGateSection, page = 0) => {
    setSection(s);
    try {
      const res = await adminApi.publishGateSection(market, s, page, PAGE_SIZE);
      setRows(res.data);
      setOpened((o) => (o.includes(s) ? o : [...o, s]));
    } catch (err) {
      setRows(null);
      setProblem(errorMessage(err, "Couldn't load this section."));
    }
  };

  const downloadCsv = async () => {
    setProblem('');
    try {
      const res = await adminApi.publishGateCsv(market);
      const disposition = String((res.headers as Record<string, unknown> | undefined)?.['content-disposition'] ?? '');
      const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `publish-gate-dry-run-${market}.csv`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setDownload(`CSV downloaded at ${new Date().toLocaleString()}.`);
    } catch (err) {
      setProblem(errorMessage(err, "Couldn't download the CSV."));
    }
  };

  // U-1: the report must be the one under review, right before the dialog opens
  const startSignOff = async () => {
    setProblem('');
    setResult(null);
    try {
      const fresh = (await adminApi.publishGateSummary(market)).data;
      if (fresh.fingerprint !== reviewed || fresh.blockers.length > 0) {
        startReview(fresh);
        setProblem('The report changed since you started reviewing. Refresh and review again.');
        return;
      }
      setSummary(fresh);
      setChecked(false);
      setDialog(true);
    } catch (err) {
      setProblem(errorMessage(err, "Couldn't check the report. Nothing was signed."));
    }
  };

  const closeDialog = () => {
    if (busy) return;
    returnFocus.current = true;
    setDialog(false);
  };

  const submit = async () => {
    if (!checked || busy || !reviewed) return;
    setBusy(true);
    try {
      const res = await adminApi.signOffPublishGate(market, reviewed);
      setResult(res.data);
      const fresh = (await adminApi.publishGateSummary(market).catch(() => null))?.data;
      if (fresh) {
        if (fresh.fingerprint === reviewed) setSummary(fresh);
        else startReview(fresh);
      }
    } catch (err) {
      setProblem(signOffError(err));
      const changed = (err as ApiFailure)?.response?.data?.code === 'DRY_RUN_CHANGED';
      if (changed) adminApi.publishGateSummary(market).then((r) => startReview(r.data)).catch(() => undefined);
    } finally {
      setBusy(false);
      returnFocus.current = true;
      setDialog(false);
    }
  };

  const counts = summary?.counts;
  const missing = summary ? MUST_OPEN.filter((s) => counts && counts[SECTIONS.find((x) => x.value === s)!.countKey] > 0 && !opened.includes(s)) : [];
  const blocked = (summary?.blockers.length ?? 0) > 0;
  const canSignOff = !!summary && !blocked && missing.length === 0 && !busy;
  const warnings: string[] = [];
  if (summary && counts) {
    if (counts.errors > 0) warnings.push(`${plural(counts.errors, 'restaurant', 'restaurants')} couldn't be evaluated.`);
    if (counts.review > 0) warnings.push(`${plural(counts.review, 'restaurant needs', 'restaurants need')} review.`);
    if (!summary.periodEndEnabled) warnings.push('Period-end processing is off: some restaurants may be allowed only because of it (see Needs review).');
    if (summary.latestSignOff && !summary.latestSignOff.valid) {
      warnings.push(`The latest sign-off is no longer valid (older than ${VALIDITY_DAYS} days or for another cut-over).`);
    }
  }
  const validUntil = (iso: string) => new Date(new Date(iso).getTime() + VALIDITY_DAYS * 86_400_000).toLocaleString();

  return (
    <section aria-labelledby="gate-heading" className="space-y-5">
      <div>
        <h2 id="gate-heading" className="text-xl font-bold text-gray-900">Publishing gate dry run</h2>
        <p className="mt-1 text-sm text-gray-700">
          Read-only report of what the publishing gate would do. Signing off records your review; it does not turn the gate on.
        </p>
      </div>

      <fieldset className="flex flex-wrap items-center gap-4 text-sm">
        <legend className="mb-1 font-semibold text-gray-900">Market</legend>
        {MARKETS.map((m) => (
          <label key={m.value} className="flex items-center gap-2">
            <input type="radio" name="market" value={m.value} checked={market === m.value} onChange={() => setMarket(m.value)} />
            {m.label}
          </label>
        ))}
      </fieldset>

      {loadError && <p role="alert" className="text-sm text-red-700">{loadError}</p>}
      {!summary && !loadError && <p role="status" className="text-sm text-gray-500">Loading…</p>}

      {summary && counts && (
        <>
          <div role="region" aria-label="Report facts" className="rounded-xl bg-white p-4 text-sm shadow-sm">
            <ul className="grid gap-1 sm:grid-cols-2">
              <li>Generated: {when(summary.generatedAt)}</li>
              <li>Cut-over: {summary.cutOver ?? 'Not configured'}</li>
              <li>Configuration: {summary.config
                ? `${summary.config.setting === 'SETTING_1' ? 'Setting 1' : 'Setting 2'} (${summary.config.models.map((m) => `Model ${m.slice(-1)}`).join(', ')}), version ${summary.config.version}`
                : 'Not configured'}</li>
              <li>Owner plans: {summary.ownerPlansVisible ? 'Visible' : 'Hidden'}</li>
              <li>Trials: {onOff(summary.trialsEnabled)}</li>
              <li>Self-service: {onOff(summary.selfServiceEnabled)}</li>
              <li>Period-end processing: {onOff(summary.periodEndEnabled)}</li>
              <li>Billing: {onOff(summary.billingEnabled)}</li>
              <li>Publishing gate: {onOff(summary.gateEnabled)}</li>
              <li>Latest sign-off: {summary.latestSignOff?.signedAt
                ? `${when(summary.latestSignOff.signedAt)}${summary.latestSignOff.by ? ` by ${summary.latestSignOff.by}` : ''} (${summary.latestSignOff.valid ? 'valid' : 'no longer valid'})`
                : 'None'}</li>
            </ul>
            <button type="button" onClick={refresh} className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-800 hover:bg-gray-100">
              Refresh report
            </button>
          </div>

          {blocked && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="font-semibold">This report can't be signed off:</p>
              <ul className="mt-1 list-disc pl-5">{summary.blockers.map((b) => <li key={b}>{words(BLOCKERS, b)}</li>)}</ul>
            </div>
          )}

          <div role="region" aria-label="Counts" className="rounded-xl bg-white p-4 shadow-sm">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {([
                ['Exempt (existing)', counts.exempt], ['Allowed (new, with a plan)', counts.allowed], ['Blocked (new, no plan)', counts.blocked],
                ['Evaluation errors', counts.errors], ['Total restaurants', counts.total], ['Published menus without a plan', counts.publishedWithoutPlan],
                ['Needs review', counts.review], ['Not gated (other countries)', counts.notGated],
              ] as [string, number][]).map(([label, value]) => (
                <div key={label} className="rounded-lg bg-gray-50 p-3">
                  <dt className="text-gray-700">{label}</dt>
                  <dd className="text-xl font-bold text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {warnings.length > 0 && (
            <div role="region" aria-label="Warnings" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <ul className="list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}

          <div role="group" aria-label="Sections" className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <button key={s.value} type="button" aria-pressed={section === s.value} onClick={() => openSection(s.value)}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${section === s.value ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-800 hover:bg-gray-100'}`}>
                {s.label} ({counts[s.countKey]})
              </button>
            ))}
          </div>

          {section && rows && rows.section === section && (
            <SectionTable rows={rows} onPage={(p) => openSection(section, p)} />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={downloadCsv} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100">
              Download CSV ({market})
            </button>
            {download && <span role="status" className="text-sm text-gray-700">{download}</span>}
          </div>

          {problem && <p role="alert" className="text-sm text-red-700">{problem}</p>}

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <button ref={trigger} type="button" onClick={startSignOff} disabled={!canSignOff}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400">
              Sign off {market}…
            </button>
            {blocked && <p className="mt-2 text-sm text-gray-700">Resolve the blockers above before signing off.</p>}
            {!blocked && missing.length > 0 && (
              <p className="mt-2 text-sm text-gray-700">Open {joinList(missing.map(sectionLabel))} before signing off.</p>
            )}
            {result && (
              <p role="status" aria-label="Sign-off result" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                Signed off on {when(result.signedAt)}. Valid until {validUntil(result.signedAt)} for cut-over {result.cutOver}.
              </p>
            )}
            {problem === 'Your admin session ended. Sign in again.' && (
              <p className="mt-2 text-sm"><Link to="/super-admin/login" className="font-semibold underline">Go to admin sign-in</Link></p>
            )}
          </div>
        </>
      )}

      <Modal open={dialog} onClose={closeDialog} className="max-w-lg">
        {summary && (
          <div role="dialog" aria-modal="true" aria-label={`Sign off the ${market} dry run`}>
            <h3 className="text-lg font-semibold text-gray-900">Sign off the {market} dry run</h3>
            <p className="mt-2 text-sm text-gray-700">
              This records that you reviewed this exact report. It does not turn on publishing restrictions; that is a separate configuration change.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-gray-800">
              <li>Market: {market}</li>
              <li>Cut-over: {summary.cutOver}</li>
              <li>Configuration version: {summary.config?.version}</li>
              <li>Generated: {when(summary.generatedAt)}</li>
              <li>Exempt {counts?.exempt} · Allowed {counts?.allowed} · Blocked {counts?.blocked} · Errors {counts?.errors} · Published without a plan {counts?.publishedWithoutPlan} · Needs review {counts?.review}</li>
              <li>Report fingerprint: <code>{reviewed?.slice(0, 12)}</code>
                <details className="inline-block align-top"><summary className="ml-2 cursor-pointer text-xs underline">Full fingerprint</summary><code className="break-all text-xs">{reviewed}</code></details>
              </li>
            </ul>
            <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-900">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              I have reviewed this report for {market}
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={closeDialog} disabled={busy} autoFocus
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100">
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={!checked || busy}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400">
                {busy ? 'Signing off…' : `Sign off ${market}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

function SectionTable({ rows, onPage }: { rows: PublishGatePage; onPage: (page: number) => void }) {
  const label = sectionLabel(rows.section);
  const pages = Math.max(1, Math.ceil(rows.total / rows.size));
  const menus = rows.section === 'PUBLISHED_WITHOUT_PLAN';
  const reason = (r: PublishGateRow) => [
    words(REASONS, r.reason),
    r.pendingRequest ? 'Pending plan request' : '',
    r.openCheckout ? 'Open checkout' : '',
    r.paymentUnderReview ? 'Payment under review' : '',
  ].filter(Boolean).join(' · ');

  if (rows.total === 0) {
    return <p className="text-sm text-gray-700">{menus ? 'No published menus in this section.' : 'No restaurants in this section.'}</p>;
  }
  return (
    <div>
      <div role="region" aria-label={`${label} (scrolls sideways)`} tabIndex={0} className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table aria-label={label} className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-700">
            {menus ? (
              <tr><th className="px-3 py-2">Menu</th><th className="px-3 py-2">Restaurant</th><th className="px-3 py-2">Restaurant status</th></tr>
            ) : (
              <tr>
                <th className="px-3 py-2">Restaurant</th><th className="px-3 py-2">Country</th><th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Owner</th><th className="px-3 py-2">Published menus</th><th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">{rows.section === 'REVIEW' ? 'Flags' : 'Reason'}</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.items.map((r, i) => menus ? (
              <tr key={r.menuId ?? i} className="border-t border-gray-100">
                <td className="px-3 py-2">{r.menuName}</td><td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{words(SECTION_NAMES, r.restaurantSection)}</td>
              </tr>
            ) : (
              <tr key={r.businessId ?? i} className="border-t border-gray-100">
                <td className="px-3 py-2">{r.name}</td><td className="px-3 py-2">{r.country}</td>
                <td className="px-3 py-2">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</td>
                <td className="px-3 py-2">{r.ownerStatus ?? ''}{r.emailVerified === false ? ' (email not verified)' : ''}</td>
                <td className="px-3 py-2">{r.publishedMenus ?? ''}</td><td className="px-3 py-2">{r.plan ?? 'None'}</td>
                <td className="px-3 py-2">
                  {rows.section === 'REVIEW'
                    ? (r.flags ?? []).map((f) => <span key={f} className="mr-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{words(FLAGS, f)}</span>)
                    : reason(r)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-3 text-sm">
        <button type="button" onClick={() => onPage(rows.page - 1)} disabled={rows.page === 0} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50">
          Previous page
        </button>
        <span>Page {rows.page + 1} of {pages}</span>
        <button type="button" onClick={() => onPage(rows.page + 1)} disabled={rows.page + 1 >= pages} className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50">
          Next page
        </button>
      </div>
    </div>
  );
}
