import { useEffect, useState } from 'react';
import Card from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import * as api from '../../api/ads';
import { Ad } from '../../types';
import { useAuth } from '../../app/context/AuthContext';

export default function AdsPage() {
  const { session } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [form, setForm] = useState({ title: '', link: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) api.listAds(session.tenantId).then(setAds);
  }, [session]);

  const create = async () => {
    if (!session) return;
    setLoading(true);
    const newAd = await api.createAd({
      tenantId: session.tenantId,
      title: form.title,
      imageUrl: '',
      linkUrl: form.link,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      active: true,
    });
    setAds((d) => [...d, newAd]);
    setForm({ title: '', link: '' });
    setLoading(false);
  };

  const del = async (id: string) => {
    if (!confirm('Delete ad?')) return;
    await api.deleteAd(id);
    setAds((d) => d.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="mb-2 text-lg font-semibold">Create Ad</h1>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Input
            placeholder="Link URL"
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
          />
          <Button onClick={create} isLoading={loading}>
            Add
          </Button>
        </div>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-semibold">Ads</h2>
        <ul className="space-y-2">
          {ads.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded border p-2">
              <span>{d.title}</span>
              <Button variant="danger" onClick={() => del(d.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
