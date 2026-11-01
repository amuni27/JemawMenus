import { useCallback, useEffect, useState } from 'react';
import {
  adminApi, type MonetizationConfig, type MonetizationHistoryPage, type MonetizationModel, type MonetizationSetting,
} from '../../api/adminApi';
import Modal from '../../components/ui/Modal';
import ModalHeader from '../../components/ui/ModalHeader';
import { errorMessage } from '../../utils/errorMessage';

// AGF E4-M2: the platform monetization configuration. Setting 1 = Model 1 only; Setting 2 = at least one of Models 2-4.
// Every save is a new version (the backend validates again and answers 409 if someone else saved first). Nothing changes
// for restaurants yet: plans and subscriptions come with later E4 stories.

const HISTORY_SIZE = 20;
const SETTING_2_MODELS: MonetizationModel[] = ['MODEL_2', 'MODEL_3', 'MODEL_4'];
const MODEL_LABELS: Record<MonetizationModel, string> = {
  MODEL_1: 'Model 1: free trial, then paid subscription',
  MODEL_2: 'Model 2: free, with Agafari ads',
  MODEL_3: 'Model 3: paid, with restaurant ads on its own menus',
  MODEL_4: 'Model 4: lower-cost paid plan, no ads',
};
// Console buttons: dark on white (the shared brand Button is below AA contrast, a known pre-existing defect)
const PRIMARY = 'rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400';
const SECONDARY = 'rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-50';
const short = (m: MonetizationModel) => `Model ${m.slice(-1)}`;
const settingName = (s: MonetizationSetting) => (s === 'SETTING_1' ? 'Setting 1' : 'Setting 2');
const describe = (c: MonetizationConfig | null) =>
  c?.configured && c.setting && c.models ? `${settingName(c.setting)}: ${c.models.map(short).join(', ')}` : 'Not configured';

export default function SuperAdminMonetization() {
  const [current, setCurrent] = useState<MonetizationConfig | null>(null);
  const [history, setHistory] = useState<MonetizationHistoryPage | null>(null);
  const [setting, setSetting] = useState<MonetizationSetting | null>(null);
  const [models, setModels] = useState<MonetizationModel[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [config, versions] = await Promise.all([adminApi.monetizationConfig(), adminApi.monetizationHistory(0, HISTORY_SIZE)]);
    setCurrent(config.data);
    setHistory(versions.data);
    setSetting(config.data.configured ? config.data.setting ?? null : null);
    setModels(config.data.setting === 'SETTING_2' ? config.data.models ?? [] : []);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(errorMessage(err, "Couldn't load the monetization configuration.")));
  }, [load]);

  const chosen: MonetizationModel[] = setting === 'SETTING_1' ? ['MODEL_1'] : SETTING_2_MODELS.filter((m) => models.includes(m));
  const needsModel = setting === 'SETTING_2' && chosen.length === 0;
  const canSave = !!setting && !needsModel && !busy;
  const toggle = (m: MonetizationModel) => setModels((ms) => (ms.includes(m) ? ms.filter((x) => x !== m) : [...ms, m]));

  const submit = async () => {
    if (!setting) return;
    setBusy(true);
    setError('');
    try {
      const res = await adminApi.saveMonetizationConfig({ setting, models: chosen, expectedVersion: current?.version ?? 0 });
      setConfirming(false);
      setCurrent(res.data);
      setHistory((await adminApi.monetizationHistory(0, HISTORY_SIZE)).data);
    } catch (err) {
      setConfirming(false);
      setError(errorMessage(err, "Couldn't save the configuration."));
      if ((err as { response?: { status?: number } })?.response?.status === 409) await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  if (!current) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Monetization</h1>
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : <p className="mt-3 text-sm text-gray-500">Loading…</p>}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Monetization</h1>
        <p className="mt-1 text-sm text-gray-600">
          Choose how Agafari earns money. Nothing changes for restaurants until plan features are released.
        </p>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

        <div role="region" aria-label="Current configuration" className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
          {current.configured && current.setting && current.models ? (
            <>
              <p className="font-semibold text-gray-900">{settingName(current.setting)}</p>
              <ul className="mt-1 list-disc pl-5 text-gray-700">
                {current.models.map((m) => <li key={m}>{MODEL_LABELS[m]}</li>)}
              </ul>
              <p className="mt-2 text-gray-600">
                Version {current.version} · effective {current.effectiveFrom ? new Date(current.effectiveFrom).toLocaleString() : ''} · changed by {current.changedBy}
              </p>
            </>
          ) : (
            <p className="font-semibold text-gray-900">Not configured</p>
          )}
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-gray-900">Setting</legend>
          <label className="mt-2 flex items-start gap-2 text-sm text-gray-800">
            <input type="radio" name="setting" className="mt-1" checked={setting === 'SETTING_1'} onChange={() => setSetting('SETTING_1')} />
            <span>Setting 1: Model 1 only (free trial, then paid subscription)</span>
          </label>
          <label className="mt-2 flex items-start gap-2 text-sm text-gray-800">
            <input type="radio" name="setting" className="mt-1" checked={setting === 'SETTING_2'} onChange={() => setSetting('SETTING_2')} />
            <span>Setting 2: choose models</span>
          </label>
        </fieldset>

        <fieldset className="mt-4 pl-6" disabled={setting !== 'SETTING_2'} aria-describedby={needsModel ? 'models-hint' : undefined}>
          <legend className="sr-only">Setting 2 models</legend>
          {SETTING_2_MODELS.map((m) => (
            <label key={m} className={`mt-2 flex items-start gap-2 text-sm ${setting === 'SETTING_2' ? 'text-gray-800' : 'text-gray-500'}`}>
              <input type="checkbox" className="mt-1" disabled={setting !== 'SETTING_2'}
                     checked={setting === 'SETTING_2' && models.includes(m)} onChange={() => toggle(m)} />
              <span>{MODEL_LABELS[m]}</span>
            </label>
          ))}
          {needsModel && <p id="models-hint" className="mt-2 text-sm text-red-700">Choose at least one of Models 2, 3 and 4.</p>}
        </fieldset>

        <div className="mt-5">
          <button type="button" className={PRIMARY} onClick={() => setConfirming(true)} disabled={!canSave}>Save configuration</button>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">History</h2>
        {history && history.items.length === 0 && <p className="mt-3 text-sm text-gray-600">No versions yet.</p>}
        {history && history.items.length > 0 && (
          <div role="region" aria-label="Configuration history (scrolls sideways)" tabIndex={0}
               className="mt-4 overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
            <table aria-label="Configuration history" className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-600">
                  <th scope="col" className="py-2 pr-4 font-semibold">Version</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Setting</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Models</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Effective from</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Changed by</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((v) => (
                  <tr key={v.version} className="border-b last:border-0">
                    <td className="py-2 pr-4">{v.version}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{v.setting ? settingName(v.setting) : ''}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{(v.models ?? []).map(short).join(', ')}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{v.effectiveFrom ? new Date(v.effectiveFrom).toLocaleString() : ''}</td>
                    <td className="py-2 pr-4">{v.changedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={confirming} onClose={() => !busy && setConfirming(false)} className="max-w-md">
        <div role="dialog" aria-modal="true" aria-label="Change monetization configuration">
          <ModalHeader title="Change monetization configuration" onClose={() => !busy && setConfirming(false)} />
          <dl className="text-sm text-gray-800">
            <dt className="font-semibold">From</dt>
            <dd className="mb-2">{describe(current)}</dd>
            <dt className="font-semibold">To</dt>
            <dd>{setting ? `${settingName(setting)}: ${chosen.map(short).join(', ')}` : ''}</dd>
          </dl>
          <p className="mt-3 text-xs text-gray-600">
            Existing subscriptions keep their terms until their renewal or transition date. Nothing changes for restaurants
            until plan features are released.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
            <button type="button" className={PRIMARY} onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
