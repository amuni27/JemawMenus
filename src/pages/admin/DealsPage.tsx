

export default function DealsPage() {
  // const { session } = useAuth();
  // const [deals, setDeals] = useState<Deal[]>([]);
  // const [form, setForm] = useState({ title: '', start: '', end: '' });
  // const [loading, setLoading] = useState(false);
  //
  // useEffect(() => {
  //   if (session) api.listDeals(session.tenantId).then(setDeals);
  // }, [session]);
  //
  // const create = async () => {
  //   if (!session) return;
  //   setLoading(true);
  //   const newDeal = await api.createDeal({
  //     tenantId: session.tenantId,
  //     title: form.title,
  //     description: '',
  //     startDate: form.start,
  //     endDate: form.end,
  //     active: true,
  //   });
  //   setDeals((d) => [...d, newDeal]);
  //   setForm({ title: '', start: '', end: '' });
  //   setLoading(false);
  // };
  //
  // const del = async (id: string) => {
  //   if (!confirm('Delete deal?')) return;
  //   await api.deleteDeal(id);
  //   setDeals((d) => d.filter((x) => x.id !== id));
  // };

  return (
    <div className="space-y-4">
      {/*<Card>*/}
      {/*  <h1 className="mb-2 text-lg font-semibold">Create Deal</h1>*/}
      {/*  <div className="grid grid-cols-1 gap-2 md:grid-cols-4">*/}
      {/*    <Input*/}
      {/*      placeholder="Title"*/}
      {/*      value={form.title}*/}
      {/*      onChange={(e) => setForm({ ...form, title: e.target.value })}*/}
      {/*    />*/}
      {/*    <Input*/}
      {/*      type="date"*/}
      {/*      value={form.start}*/}
      {/*      onChange={(e) => setForm({ ...form, start: e.target.value })}*/}
      {/*    />*/}
      {/*    <Input*/}
      {/*      type="date"*/}
      {/*      value={form.end}*/}
      {/*      onChange={(e) => setForm({ ...form, end: e.target.value })}*/}
      {/*    />*/}
      {/*    <Button onClick={create} isLoading={loading}>*/}
      {/*      Add*/}
      {/*    </Button>*/}
      {/*  </div>*/}
      {/*</Card>*/}
      {/*<Card>*/}
      {/*  <h2 className="mb-2 text-lg font-semibold">Today’s Deals</h2>*/}
      {/*  <ul className="space-y-2">*/}
      {/*    {deals.map((d) => (*/}
      {/*      <li key={d.id} className="flex items-center justify-between rounded border p-2">*/}
      {/*        <span>*/}
      {/*          {d.title} ({d.startDate} → {d.endDate})*/}
      {/*        </span>*/}
      {/*        <Button variant="danger" onClick={() => del(d.id)}>*/}
      {/*          Delete*/}
      {/*        </Button>*/}
      {/*      </li>*/}
      {/*    ))}*/}
      {/*  </ul>*/}
      {/*</Card>*/}
    </div>
  );
}
