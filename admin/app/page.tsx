import Link from 'next/link'

const quickLinks = [
  {
    title: 'Tenant Directory',
    description: 'View tenants, plan tiers, usage, and manually trigger remediation workflows.',
    href: '/tenants'
  },
  {
    title: 'Platform Health',
    description: 'Monitor service uptime, queue depths, and background processor status.',
    href: '/health'
  },
  {
    title: 'Alerts & Incidents',
    description: 'Review escalations piped from Better Stack, PagerDuty, and Sentry.',
    href: '/alerts'
  },
  {
    title: 'Merchant Onboarding',
    description: 'Guide new merchants through store setup. Progress persists via the Store API.',
    href: '/onboarding'
  }
]

export default function Page() {
  return (
    <section className="space-y-8">
      <article className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg shadow-slate-950/40">
        <h2 className="text-xl font-semibold text-emerald-300">Welcome, Operator</h2>
        <p className="mt-3 text-sm text-slate-300">
          This dashboard aggregates cross-tenant telemetry, platform metrics, and critical actions. Today it only
          renders placeholder cards but mirrors the structure we&rsquo;ll expand during future sprints.
        </p>
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        {quickLinks.map((card) => (
          <div key={card.title} className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 transition hover:border-emerald-500">
            <h3 className="text-lg font-medium text-emerald-200">{card.title}</h3>
            <p className="mt-2 text-sm text-slate-300">{card.description}</p>
            <Link href={card.href} className="mt-4 inline-flex items-center text-sm font-semibold text-emerald-400">
              View section →
            </Link>
          </div>
        ))}
      </div>

      <article className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-5 text-amber-200">
        <h3 className="text-lg font-semibold">Access policy reminder</h3>
        <p className="mt-2 text-sm">
          All requests flow through Cloudflare Access. When you deploy this app, set up an Access application and
          allow requests from your operator email addresses. The middleware denies traffic that lacks the
          <code className="mx-1 rounded bg-slate-800 px-1">CF-Access-Jwt-Assertion</code> header.
        </p>
      </article>
    </section>
  )
}
