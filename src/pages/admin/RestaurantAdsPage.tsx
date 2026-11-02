import { useCallback, useEffect, useState } from 'react';
import restaurantAdsApi, { type RestaurantAd, type RestaurantAdInput, type RestaurantAdsView } from '../../api/restaurantAdsApi';
import Modal from '../../components/ui/Modal';
import ModalHeader from '../../components/ui/ModalHeader';
import SponsoredSlot from '../../components/menu/SponsoredSlot';
import { errorMessage } from '../../utils/errorMessage';
import { PRIMARY, SECONDARY } from '../superadmin/consoleButtons';

// AGF E4-M8: the owner's own ads, shown only on this restaurant's guest menu (Model 3). Schedules are entered in the
// restaurant's own time zone (shown, not selectable, Q-M8-7): a time that occurs twice needs an offset, and an edit keeps
// the stored local time and offset. At most 20 ads that aren't archived (a safety cap). Agafari may suspend an ad (the
// reason is shown); the owner can then edit or archive it but not run it. Without a current Model 3 plan: view and archive.

const STATUS: Record<RestaurantAd['status'], string> = { ACTIVE: 'Active', PAUSED: 'Paused', SUSPENDED: 'Suspended by Agafari', ARCHIVED: 'Archived' };
const RULES = 'Ads must not be illegal, misleading or offensive. Agafari may suspend an ad that breaks these rules.';
const READ_ONLY = "Your plan doesn't include restaurant ads. You can view and archive your ads.";
const when = (local?: string, offset?: string, zone?: string) => (local ? `${local.replace('T', ' ')} (${zone}, UTC${offset})` : '');
const OFFSETS = /\(([+-]\d{2}:\d{2}) or ([+-]\d{2}:\d{2})\)/;

type Form = Omit<RestaurantAdInput, 'rowVersion'> & { id?: string; rowVersion?: number; imageUrl?: string; imageAlt?: string };
type Errors = Record<string, string>;
const empty = (): Form => ({ title: '', body: '', titleAm: '', bodyAm: '', linkUrl: 'https://', startLocal: '', endLocal: '' });
const fromAd = (a: RestaurantAd): Form => ({ id: a.id, title: a.title, body: a.body, titleAm: a.titleAm ?? '', bodyAm: a.bodyAm ?? '', linkUrl: a.linkUrl,
  startLocal: a.startLocal, startOffset: a.startOffset, endLocal: a.endLocal ?? '', endOffset: a.endOffset, rowVersion: a.rowVersion,
  imageUrl: a.imageUrl, imageAlt: a.imageAlt });

function fieldErrors(err: unknown): Errors {
  const list = (err as { response?: { data?: { fieldErrors?: { field: string; message: string }[] } } })?.response?.data?.fieldErrors ?? [];
  return Object.fromEntries(list.map((f) => [f.field, f.message]));
}

export default function RestaurantAdsPage() {
  const [view, setView] = useState<RestaurantAdsView | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [archiving, setArchiving] = useState<RestaurantAd | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imageAlt, setImageAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => restaurantAdsApi.list().then((res) => setView(res.data)), []);
  useEffect(() => {
    let alive = true;
    restaurantAdsApi.list().then((res) => alive && setView(res.data), (err) => alive && setError(errorMessage(err, "Couldn't load your ads.")));
    return () => { alive = false; };
  }, []);

  const zone = view?.timeZone ?? '';
  const canManage = view?.canManage ?? false;
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const open = (f: Form) => { setForm(f); setErrors({}); setImage(null); setImageAlt(f.imageAlt ?? ''); setError(''); };

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setErrors({});
    const input: RestaurantAdInput = { title: form.title, body: form.body, titleAm: form.titleAm || undefined, bodyAm: form.bodyAm || undefined,
      linkUrl: form.linkUrl, startLocal: form.startLocal, endLocal: form.endLocal || undefined, startOffset: form.startOffset || undefined,
      endOffset: form.endLocal ? form.endOffset || undefined : undefined, ...(form.id ? { rowVersion: form.rowVersion } : {}) };
    try {
      if (form.id) await restaurantAdsApi.update(form.id, input); else await restaurantAdsApi.create(input);
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
      const presigned = (await restaurantAdsApi.presignImage(form.id, image.type)).data;
      const put = await fetch(presigned.uploadUrl, { method: 'PUT', body: image, headers: { 'Content-Type': image.type } });
      if (!put.ok) throw new Error('upload failed');
      const saved = (await restaurantAdsApi.confirmImage(form.id, presigned.objectKey, imageAlt, form.rowVersion ?? 0)).data;
      set({ rowVersion: saved.rowVersion, imageUrl: saved.imageUrl, imageAlt: saved.imageAlt });
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
      const saved = (await restaurantAdsApi.removeImage(form.id!, form.rowVersion ?? 0)).data;
      set({ rowVersion: saved.rowVersion, imageUrl: undefined, imageAlt: undefined });
    });
  };

  const offsetChoice = (field: 'startLocal' | 'endLocal') => errors[field]?.match(OFFSETS);
  const list = view?.ads ?? [];

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ads</h1>
          <p className="mt-1 text-sm text-gray-600">Your own ads, shown one at a time on your guest menu only.</p>
        </div>
        {canManage && <button type="button" className={PRIMARY} onClick={() => open(empty())}>New ad</button>}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {view && !canManage && <p className="mt-3 rounded-lg bg-gray-100 p-3 text-sm text-gray-800">{READ_ONLY}</p>}
      {view && <p className="mt-3 text-xs text-gray-600">{view.nonArchivedCount} of {view.cap} ads in use (archived ads don't count)</p>}
      <p className="mt-1 text-xs text-gray-600">{RULES}</p>
      {view && list.length === 0 && <p className="mt-3 text-sm text-gray-600">No ads yet.</p>}
      {list.length > 0 && (
        <div role="region" aria-label="Your ads (scrolls sideways)" tabIndex={0}
             className="mt-3 overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
          <table aria-label="Your ads" className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-600">
                <th scope="col" className="py-2 pr-4 font-semibold">Ad</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Schedule</th>
                <th scope="col" className="py-2 pr-4 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-b align-top last:border-0">
                  <td className="py-2 pr-4"><p className="font-medium text-gray-900">{a.title}</p><p className="text-gray-600">{a.linkUrl}</p></td>
                  <td className="py-2 pr-4">
                    <p>{STATUS[a.status]}</p>
                    {a.status === 'SUSPENDED' && a.suspensionReason && <p className="text-gray-700">Reason: {a.suspensionReason}</p>}
                  </td>
                  <td className="py-2 pr-4 text-gray-700">
                    <p>Starts {when(a.startLocal, a.startOffset, a.scheduleTimeZone)}</p>
                    <p>{a.endLocal ? `Ends ${when(a.endLocal, a.endOffset, a.scheduleTimeZone)}` : 'No end'}</p>
                  </td>
                  <td className="py-2 pr-4">
                    {a.status !== 'ARCHIVED' && (
                      <div className="flex flex-wrap gap-2">
                        {canManage && <button type="button" className={SECONDARY} aria-label={`Edit ${a.title}`} onClick={() => open(fromAd(a))} disabled={busy}>Edit</button>}
                        {canManage && a.status === 'ACTIVE' && (
                          <button type="button" className={SECONDARY} aria-label={`Pause ${a.title}`} onClick={() => act(() => restaurantAdsApi.pause(a.id, a.rowVersion))} disabled={busy}>Pause</button>
                        )}
                        {canManage && a.status === 'PAUSED' && (
                          <button type="button" className={SECONDARY} aria-label={`Resume ${a.title}`} onClick={() => act(() => restaurantAdsApi.resume(a.id, a.rowVersion))} disabled={busy}>Resume</button>
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
              {(['start', 'end'] as const).map((which) => {
                const field = which === 'start' ? 'startLocal' : 'endLocal';
                const offsetField = which === 'start' ? 'startOffset' : 'endOffset';
                const choice = offsetChoice(field);
                return (
                  <div key={which} className="flex flex-col">
                    <label className="flex flex-col">
                      {which === 'start' ? 'Start' : 'End (optional)'} ({zone})
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
              {form.title && (
                <div>
                  <p className="font-medium text-gray-900">Preview</p>
                  <SponsoredSlot lang="en" ad={{ adId: form.id ?? 'preview', title: form.title, body: form.body, linkUrl: form.linkUrl,
                    imageUrl: form.imageUrl, imageAlt: form.imageAlt }} />
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
          <p className="text-sm text-gray-800">{archiving?.title}: it stops being shown and can't be changed or used again afterwards.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setArchiving(null)} disabled={busy}>Cancel</button>
            <button type="button" className={PRIMARY} onClick={() => archiving && act(() => restaurantAdsApi.archive(archiving.id, archiving.rowVersion))} disabled={busy}>
              {busy ? 'Archiving…' : 'Archive'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
