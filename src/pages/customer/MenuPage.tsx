import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as tenantApi from '../../api/tenant';
import * as menuApi from '../../api/menu';
import * as dealsApi from '../../api/deals';
import * as adsApi from '../../api/ads';
import { MenuCategory, MenuItem, Deal, Ad } from '../../types';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';

export default function CustomerMenu() {
  const { tenantSlug } = useParams();
  const [tenantName, setTenantName] = useState('');
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [activeCat, setActiveCat] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [modalItem, setModalItem] = useState<MenuItem | undefined>();

  useEffect(() => {
    if (!tenantSlug) return;
    tenantApi.getTenantBySlug(tenantSlug).then((t) => t && setTenantName(t.name));
  }, [tenantSlug]);

  useEffect(() => {
    (async () => {
      if (!tenantSlug) return;
      const t = await tenantApi.getTenantBySlug(tenantSlug);
      if (!t) return;
      const [c, i, d, a] = await Promise.all([
        menuApi.getCategories(t.id),
        menuApi.getItems(t.id),
        dealsApi.listDeals(t.id),
        adsApi.listAds(t.id),
      ]);
      setCats(c);
      setItems(i);
      setDeals(d);
      setAds(a);
      setActiveCat(c[0]?.id);
    })();
  }, [tenantSlug]);

  const filteredItems = items.filter((i) => {
    if (activeCat && i.categoryId !== activeCat) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-md p-4">
      <header className="mb-4 text-center">
        <h1 className="text-2xl font-bold">{tenantName}</h1>
        {deals.length > 0 && (
          <div className="mt-2 space-y-1">
            {deals.map((d) => (
              <Badge key={d.id} color="green">
                {d.title}
              </Badge>
            ))}
          </div>
        )}
      </header>
      {ads.map((a) => (
        <a
          key={a.id}
          href={a.linkUrl || '#'}
          className="mb-3 block overflow-hidden rounded-lg shadow-md"
        >
          {a.imageUrl ? (
            <img src={a.imageUrl} alt={a.title} className="h-32 w-full object-cover" />
          ) : (
            <div className="flex h-32 items-center justify-center bg-gray-200 text-gray-700">
              {a.title}
            </div>
          )}
        </a>
      ))}
      <Input
        placeholder="Search items..."
        className="mb-4"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="mb-4 flex gap-2 overflow-x-auto whitespace-nowrap">
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={
              activeCat === c.id
                ? 'rounded-full bg-blue-600 px-4 py-1 text-white'
                : 'rounded-full bg-gray-200 px-4 py-1'
            }
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filteredItems.map((item) => (
          <Card key={item.id} className="flex items-center gap-3" onClick={() => setModalItem(item)}>
            {item.imageUrl && (
              <img src={item.imageUrl} alt={item.name} className="h-16 w-16 rounded object-cover" />
            )}
            <div className="flex-1">
              <h3 className="font-medium">{item.name}</h3>
              <p className="text-sm text-gray-600">${item.price.toFixed(2)}</p>
            </div>
            {!item.available && <Badge color="red">Sold out</Badge>}
          </Card>
        ))}
      </div>
      <Modal open={!!modalItem} onClose={() => setModalItem(undefined)}>
        {modalItem && (
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{modalItem.name}</h2>
            {modalItem.imageUrl && (
              <img src={modalItem.imageUrl} alt="" className="h-40 w-full rounded object-cover" />
            )}
            <p>{modalItem.description}</p>
            <p className="font-medium">${modalItem.price.toFixed(2)}</p>
            {modalItem.allergens?.length && (
              <p className="text-sm text-red-600">
                Allergens: {modalItem.allergens.join(', ')}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
