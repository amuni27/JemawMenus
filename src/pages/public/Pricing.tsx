export default function Pricing() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-3xl font-bold text-center">Pricing</h1>
      <div className="grid gap-6 md:grid-cols-3">
        {[
          { name: 'Starter', price: '$0', features: ['Up to 1 menu', 'QR generator'] },
          { name: 'Pro', price: '$19', features: ['Unlimited menus', 'Deals & Ads', 'Email support'] },
          { name: 'Enterprise', price: 'Contact', features: ['Custom domain', 'Priority support'] },
        ].map((tier) => (
          <div key={tier.name} className="rounded-lg border p-4 text-center shadow">
            <h2 className="mb-2 text-xl font-semibold">{tier.name}</h2>
            <p className="mb-4 text-2xl font-bold">{tier.price}</p>
            <ul className="mb-4 space-y-1 text-sm">
              {tier.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <a href="/auth/register" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Choose
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
