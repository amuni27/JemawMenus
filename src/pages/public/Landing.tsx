export default function Landing() {
  const features = [
    {
      title: 'Instant QR Menus',
      desc: 'Generate beautiful QR codes that open your live menu on any phone – no app required.',
      icon: '📱',
    },
    {
      title: 'Real-time Updates',
      desc: '86 items, add specials, or schedule deals and see changes reflected immediately.',
      icon: '⚡',
    },
    {
      title: 'Multi-Tenant',
      desc: 'Each restaurant gets its own sub-domain, branding and dashboard.',
      icon: '🏨',
    },
  ];

  return (
    <div className="bg-gray-50">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h1 className="mx-auto mb-6 max-w-3xl text-4xl font-extrabold leading-tight text-gray-900 md:text-5xl">
          Elevate your dining experience with <span className="text-rose-500">QR-powered</span> menus
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-lg text-gray-600">
          Manage stunning digital menus, deals and adverts from one beautiful dashboard. Guests simply scan &amp;
          explore.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
          <a
            href="/auth/register"
            className="rounded-full bg-rose-500 px-8 py-3 text-white shadow-lg transition hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400"
          >
            Get Started Free
          </a>
          <a
            href="/auth/login"
            className="rounded-full border border-rose-500 px-8 py-3 text-rose-500 transition hover:bg-rose-50"
          >
            Log in
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-8 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl bg-white p-8 shadow-md transition hover:shadow-lg"
            >
              <div className="mb-4 text-4xl">{f.icon}</div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">{f.title}</h3>
              <p className="text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
