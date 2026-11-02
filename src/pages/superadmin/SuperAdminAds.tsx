import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi, type AdInput, type AgafariAd } from '../../api/adminApi';
import Modal from '../../components/ui/Modal';
import ModalHeader from '../../components/ui/ModalHeader';
import { errorMessage } from '../../utils/errorMessage';
import { PRIMARY, SECONDARY } from './consoleButtons';

// AGF E4-M7: the Agafari ad inventory (E4-Q5 minimum policy). Schedules are entered as exact date and time in an explicitly
// chosen time zone and stored as UTC instants (D-M7-1): a time that occurs twice needs an offset, and an edit keeps the
// stored local time and offset so saving unchanged keeps the exact instant. "Served impressions" count deliveries with a
// guest menu, not confirmed visibility (C5). Ads are archived, never deleted.

const STATUS: Record<AgafariAd['status'], string> = { ACTIVE: 'Active', PAUSED: 'Paused', ARCHIVED: 'Archived' };
const SERVED_HELP = "Counted when the ad is delivered with a menu; this doesn't confirm the ad was seen on screen.";
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const when = (local?: string, offset?: string, zone?: string) => (local ? `${local.replace('T', ' ')} (${zone}, UTC${offset})` : '');
const OFFSETS = /\(([+-]\d{2}:\d{2}) or ([+-]\d{2}:\d{2})\)/;

type Form = AdInput & { id?: string; rowVersion?: number; imageUrl?: string };
type Errors = Record<string, string>;
const empty = (): Form => ({ title: '', body: '', titleAm: '', bodyAm: '', linkUrl: 'https://', timeZone: browserZone(), startLocal: '', endLocal: '' });
const fromAd = (a: AgafariAd): Form => ({ id: a.id, title: a.title, body: a.body, titleAm: a.titleAm ?? '', bodyAm: a.bodyAm ?? '', linkUrl: a.linkUrl,
  timeZone: a.scheduleTimeZone, startLocal: a.startLocal, startOffset: a.startOffset, endLocal: a.endLocal ?? '', endOffset: a.endOffset,
  rowVersion: a.rowVersion, imageUrl: a.imageUrl });

function fieldErrors(err: unknown): Errors {
  const list = (err as { response?: { data?: { fieldErrors?: { field: string; message: string }[] } } })?.response?.data?.fieldErrors ?? [];
  return Object.fromEntries(list.map((f) => [f.field, f.message]));
}

export default function SuperAdminAds() {
  const [list, setList] = useState<AgafariAd[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [archiving, setArchiving] = useState<AgafariAd | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => adminApi.ads().then((res) => setList(res.data)), []);
  useEffect(() => {
    let alive = true;
    adminApi.ads().then((res) => alive && setList(res.data), (err) => alive && setError(errorMessage(err, "Couldn't load the ads.")));
    return () => { alive = false; };
  }, []);

  const zones = useMemo(() => {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    return Array.from(new Set(['UTC', ...all, ...(form ? [form.timeZone] : [])]));
  }, [form]);

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const open = (f: Form) => { setForm(f); setErrors({}); setImage(null); setImageAlt(''); setError(''); };

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setErrors({});
    const input: AdInput = { title: form.title, body: form.body, titleAm: form.titleAm || undefined, bodyAm: form.bodyAm || undefined, linkUrl: form.linkUrl,
      timeZone: form.timeZone, startLocal: form.startLocal, endLocal: form.endLocal || undefined, startOffset: form.startOffset || undefined,
      endOffset: form.endLocal ? form.endOffset || undefined : undefined, ...(form.id ? { rowVersion: form.rowVersion } : {}) };
    try {
      if (form.id) await adminApi.updateAd(form.id, input); else await adminApi.createAd(input);
      setForm(null);
      await load();
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (Object.keys(fields).length === 0) setError(errorMessage(err, "Couldn't save the ad."));
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the change."));
    } finally {
      setArchiving(null);
      setBusy(false);
      await load().catch(() => undefined);
    }
  };

  const uploadImage = async () => {
    if (!form?.id || !image) return;
    setBusy(true);
    setErrors({});
    try {
      const presigned = (await adminApi.presignAdImage(form.id, image.type)).data;
      const put = await fetch(presigned.uploadUrl, { method: 'PUT', body: image, headers: { 'Content-Type': image.type } });
      if (!put.ok) throw new Error('upload failed');
      const saved = (await adminApi.confirmAdImage(form.id, presigned.objectKey, imageAlt, form.rowVersion ?? 0)).data;
      set({ rowVersion: saved.rowVersion, imageUrl: saved.imageUrl });
      setImage(null);
      await load();
    } catch (err) {
      const fields = fieldErrors(err);
      setErrors(fields);
      if (Object.keys(fields).length === 0) setError(errorMessage(err, "Couldn't upload the image."));
    } finally {
      setBusy(false);
    }
  };

  const removeImage = async () => {
    if (!form?.id) return;
    await act(async () => {
      const saved = (await adminApi.removeAdImage(form.id!, form.rowVersion ?? 0)).data;
      set({ rowVersion: saved.rowVersion, imageUrl: undefined });
    });
  };

  const offsetChoice = (field: 'startLocal' | 'endLocal') => errors[field]?.match(OFFSETS);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Agafari ads</h1>
          <p className="mt-1 text-sm text-gray-600">Shown only on Model 2 restaurants' guest menus, one at a time, when ads are enabled.</p>
        </div>
        <button type="button" className={PRIMARY} onClick={() => open(empty())}>New ad</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <p className="mt-3 text-xs text-gray-600">{SERVED_HELP}</p>
      {list && list.length === 0 && <p className="mt-3 text-sm text-gray-600">No ads yet.</p>}
      {list && list.length > 0 && (
        <div role="region" aria-label="Agafari ads (scrolls sideways)" tabIndex={0}
             className="mt-3 overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
          <table aria-label="Agafari ads" className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-600">
                <th scope="col" className="py-2 pr-4 font-semibold">Ad</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Schedule</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Served impressions</th>
                <th scope="col" className="py-2 pr-4 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-b align-top last:border-0">
                  <td className="py-2 pr-4"><p className="font-medium text-gray-900">{a.title}</p><p className="text-gray-600">{a.linkUrl}</p></td>
                  <td className="py-2 pr-4">{STATUS[a.status]}</td>
                  <td className="py-2 pr-4 text-gray-700">
                    <p>Starts {when(a.startLocal, a.startOffset, a.scheduleTimeZone)}</p>
                    <p>{a.endLocal ? `Ends ${when(a.endLocal, a.endOffset, a.scheduleTimeZone)}` : 'No end'}</p>
                  </td>
                  <td className="py-2 pr-4">{a.servedImpressions}</td>
                  <td className="py-2 pr-4">
                    {a.status !== 'ARCHIVED' && (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={SECONDARY} aria-label={`Edit ${a.title}`} onClick={() => open(fromAd(a))} disabled={busy}>Edit</button>
                        {a.status === 'ACTIVE' ? (
                          <button type="button" className={SECONDARY} aria-label={`Pause ${a.title}`} onClick={() => act(() => adminApi.pauseAd(a.id, a.rowVersion))} disabled={busy}>Pause</button>
                        ) : (
                          <button type="button" className={SECONDARY} aria-label={`Resume ${a.title}`} onClick={() => act(() => adminApi.resumeAd(a.id, a.rowVersion))} disabled={busy}>Resume</button>
                        )}
                        <button type="button" className={SECONDARY} aria-label={`Archive ${a.title}`} onClick={() => setArchiving(a)} disabled={busy}>Archive</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={form !== null} onClose={() => !busy && setForm(null)} className="max-w-lg">
        <div role="dialog" aria-modal="true" aria-label={form?.id ? 'Edit ad' : 'New ad'}>
          <ModalHeader title={form?.id ? 'Edit ad' : 'New ad'} onClose={() => !busy && setForm(null)} />
          {form && (
            <div className="flex flex-col gap-3 text-sm text-gray-800">
              {([['title', 'Title', 60], ['body', 'Text', 200], ['titleAm', 'Title in Amharic (optional)', 60], ['bodyAm', 'Text in Amharic (optional)', 200]] as const).map(([key, label, max]) => (
                <label key={key} className="flex flex-col">
                  {label}
                  <input value={form[key] ?? ''} maxLength={max} onChange={(e) => set({ [key]: e.target.value })} className="mt-1 rounded-lg border border-gray-300 px-3 py-2" />
                  {errors[key] && <span role="alert" className="mt-1 text-red-700">{errors[key]}</span>}
                </label>
              ))}
              <label className="flex flex-col">
                Link (https)
                <input value={form.linkUrl} onChange={(e) => set({ linkUrl: e.target.value })} className="mt-1 rounded-lg border border-gray-300 px-3 py-2" />
                {errors.linkUrl && <span role="alert" className="mt-1 text-red-700">{errors.linkUrl}</span>}
              </label>
              <label className="flex flex-col">
                Time zone
                <select value={form.timeZone} onChange={(e) => set({ timeZone: e.target.value, startOffset: undefined, endOffset: undefined })}
                        className="mt-1 rounded-lg border border-gray-300 px-3 py-2">
                  {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
                {errors.timeZone && <span role="alert" className="mt-1 text-red-700">{errors.timeZone}</span>}
              </label>
              {(['start', 'end'] as const).map((which) => {
                const field = which === 'start' ? 'startLocal' : 'endLocal';
                const offsetField = which === 'start' ? 'startOffset' : 'endOffset';
                const choice = offsetChoice(field);
                return (
                  <div key={which} className="flex flex-col">
                    <label className="flex flex-col">
                      {which === 'start' ? 'Start' : 'End (optional)'} ({form.timeZone})
                      <input type="datetime-local" value={form[field] ?? ''} onChange={(e) => set({ [field]: e.target.value, [offsetField]: undefined })}
                             className="mt-1 rounded-lg border border-gray-300 px-3 py-2" />
                    </label>
                    {errors[field] && <span role="alert" className="mt-1 text-red-700">{errors[field]}</span>}
                    {(choice || errors[offsetField]) && (
                      <label className="mt-2 flex flex-col">
                        {which === 'start' ? 'Start offset' : 'End offset'}
                        <select value={form[offsetField] ?? ''} onChange={(e) => set({ [offsetField]: e.target.value || undefined })}
                                className="mt-1 rounded-lg border border-gray-300 px-3 py-2">
                          <option value="">Choose…</option>
                          {(choice ? [choice[1], choice[2]] : []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                        {errors[offsetField] && <span role="alert" className="mt-1 text-red-700">{errors[offsetField]}</span>}
                      </label>
                    )}
                  </div>
                );
              })}
              {form.id && (
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="font-medium text-gray-900">Image</p>
                  {form.imageUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img src={form.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
                      <button type="button" className={SECONDARY} onClick={removeImage} disabled={busy}>Remove image</button>
                    </div>
                  )}
                  <label className="mt-2 flex flex-col">
                    Image (JPEG, PNG or WebP, up to 8 MB)
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="mt-1" />
                  </label>
                  <label className="mt-2 flex flex-col">
                    Image description
                    <input value={imageAlt} maxLength={200} onChange={(e) => setImageAlt(e.target.value)} className="mt-1 rounded-lg border border-gray-300 px-3 py-2" />
                    {errors.imageAlt && <span role="alert" className="mt-1 text-red-700">{errors.imageAlt}</span>}
                  </label>
                  <button type="button" className={`${SECONDARY} mt-2`} onClick={uploadImage} disabled={busy || !image}>Upload image</button>
                </div>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className={SECONDARY} onClick={() => setForm(null)} disabled={busy}>Cancel</button>
                <button type="button" className={PRIMARY} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={archiving !== null} onClose={() => !busy && setArchiving(null)} className="max-w-md">
        <div role="dialog" aria-modal="true" aria-label="Archive ad">
          <ModalHeader title="Archive ad" onClose={() => !busy && setArchiving(null)} />
          <p className="text-sm text-gray-800">{archiving?.title}: it stops being shown and can't be changed afterwards. Its served impressions are kept.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setArchiving(null)} disabled={busy}>Cancel</button>
            <button type="button" className={PRIMARY} onClick={() => archiving && act(() => adminApi.archiveAd(archiving.id, archiving.rowVersion))} disabled={busy}>
              {busy ? 'Archiving…' : 'Archive'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
