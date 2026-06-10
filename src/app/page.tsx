import Link from 'next/link';

const FEATURES = [
  ['Market analysis', 'Industry, audience, and competitor analysis before a single word is written.'],
  ['Full site structure', 'Sitemap, navigation, and every sub-page generated automatically.'],
  ['Conversion copy', 'Headlines, CTAs, FAQ, and body copy tuned to convert.'],
  ['Design system', 'AI color palette, typography, logo, and components — accessible by default.'],
  ['Online store', 'Catalog, cart, checkout flow, and product copy for commerce briefs.'],
  ['SEO + structured data', 'Meta tags, Open Graph, JSON-LD, sitemap, and multilingual bundles.'],
  ['Legal & policies', 'Privacy policy, terms, and cookie policy drafted for you.'],
  ['Quality gate', 'Automated SEO, accessibility, performance, and security audit with auto-fixes.'],
];

const STEPS = [
  ['Describe', 'Company name, industry, a sentence about what you do, and a style.'],
  ['Generate', 'The engine analyses, designs, writes, and assembles the entire site.'],
  ['Preview & ship', 'Review the live preview, then publish or export.'],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-brand-50/40 to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-lg font-bold text-brand-700">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">A</span>
          Aurea
        </div>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/dashboard" className="hover:text-brand-700">Dashboard</Link>
          <Link href="/admin" className="hover:text-brand-700">Admin</Link>
          <Link
            href="/generate"
            className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Start building
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="mb-4 inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
          Autonomous AI website engine
        </p>
        <h1 className="text-balance text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
          A complete website, generated from one short brief.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Tell Aurea your company name, industry, what you do, and a style. It autonomously
          researches your market, designs a brand, writes every page, builds your store, and
          ships an SEO-ready, accessible site.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/generate"
            className="rounded-xl bg-brand-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700"
          >
            Generate my site →
          </Link>
          <Link href="/dashboard" className="text-base font-semibold text-slate-700 hover:text-brand-700">
            See examples
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-brand-600 font-bold text-white">
                {i + 1}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold text-slate-900">Everything, done for you</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-10 text-center text-sm text-slate-500">
        Built with Next.js, TypeScript, Prisma, and a multi-model AI engine.
      </footer>
    </main>
  );
}
