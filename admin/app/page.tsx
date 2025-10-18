'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { capture, initPosthog } from '../lib/posthog'
import { apiFetch } from '../lib/api'

type Permission =
  | 'dashboard.view'
  | 'orders.view'
  | 'catalog.manage'
  | 'customers.view'
  | 'marketing.view'
  | 'analytics.view'
  | 'settings.manage'

interface OperatorProfile {
  name: string
  role: string
  permissions: Permission[]
}

interface NavigationItem {
  label: string
  href: string
  description: string
  permission?: Permission
}

interface MetricCard {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down' | 'flat'
  subLabel: string
}

interface NotificationItem {
  id: string
  title: string
  detail: string
  tone: 'warning' | 'info' | 'success'
  href?: string
}

interface OnboardingResponse {
  tenantId: string
  currentStep: number
  completed: boolean
  steps: Record<string, unknown>
}

type OnboardingCardState =
  | { status: 'loading'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'complete'; message: string }
  | { status: 'needs-action'; message: string; currentStep: number; totalSteps: number }

type MetricFormat = 'currency' | 'number' | 'percent'

interface MetricSummary {
  id: string
  label: string
  value: number
  change: number
  format?: MetricFormat
  helper?: string
}

interface FunnelSummary {
  label: string
  value: number
  change: number
  format?: MetricFormat
}

interface ActivityItem {
  id: string
  title: string
  detail: string
  tone: 'warning' | 'info' | 'success'
  timestamp?: string
}

interface DashboardOverview {
  metrics: MetricSummary[]
  funnel: FunnelSummary[]
  notifications: NotificationItem[]
  activity: ActivityItem[]
  generatedAt: string
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')
const STORAGE_KEY = 'iwb-operator-profile'
const onboardingSteps = ['Store details', 'Payments', 'Shipping', 'First product', 'Theme', 'Go live']

const FALLBACK_OVERVIEW: DashboardOverview = {
  metrics: [
    {
      id: 'revenue',
      label: 'Weekly revenue',
      value: 482000,
      change: 8.2,
      format: 'currency',
      helper: '74% of goal'
    },
    {
      id: 'fulfilled-orders',
      label: 'Orders fulfilled',
      value: 142,
      change: 9.2,
      format: 'number',
      helper: '98% SLA compliance'
    },
    {
      id: 'return-rate',
      label: 'Return rate',
      value: 1.3,
      change: -0.4,
      format: 'percent',
      helper: 'Healthy range: < 2%'
    },
    {
      id: 'active-stores',
      label: 'Active stores',
      value: 68,
      change: 8.0,
      format: 'number',
      helper: 'Onboarding completion 78%'
    }
  ],
  funnel: [
    { label: 'Sessions', value: 12481, change: 5.2 },
    { label: 'Carts created', value: 1042, change: 3.1 },
    { label: 'Checkouts', value: 728, change: 7.4 },
    { label: 'Conversion rate', value: 5.8, change: 0.2, format: 'percent' }
  ],
  notifications: [
    {
      id: 'inventory-1',
      title: 'Low stock · Everest Down Jacket',
      detail: '8 units remaining · 3 reservations pending',
      tone: 'warning'
    },
    {
      id: 'inventory-2',
      title: 'Supplier delay · Organic Honey 500g',
      detail: 'Inbound shipment ETA extended by 2 days',
      tone: 'info'
    }
  ],
  activity: [
    {
      id: 'feed-1',
      title: 'Provisioning run completed',
      detail: 'Demo catalog, flags, integrations seeded for Daraz Imports',
      tone: 'success'
    },
    {
      id: 'feed-2',
      title: 'Better Stack alert resolved',
      detail: 'Queue latency back within 300ms target',
      tone: 'info'
    }
  ],
  generatedAt: new Date().toISOString()
}

const currencyFormatter = new Intl.NumberFormat('en-NP', {
  style: 'currency',
  currency: 'NPR',
  maximumFractionDigits: 0
})

const numberFormatter = new Intl.NumberFormat('en-NP', {
  maximumFractionDigits: 0
})

function formatPercent(value: number, fractionDigits = 1) {
  return `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(fractionDigits)}%`
}

function formatValue(value: number, format: MetricFormat = 'number') {
  if (!Number.isFinite(value)) {
    return '0'
  }

  switch (format) {
    case 'currency':
      return currencyFormatter.format(value)
    case 'percent':
      return formatPercent(value)
    default:
      return numberFormatter.format(Math.round(value))
  }
}

function formatChange(change: number) {
  if (!Number.isFinite(change) || change === 0) {
    return '0% vs prior period'
  }
  const sign = change > 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}% vs prior period`
}

function determineTrend(change: number): 'up' | 'down' | 'flat' {
  if (change > 0.2) return 'up'
  if (change < -0.2) return 'down'
  return 'flat'
}

const defaultProfile: OperatorProfile = {
  name: 'Anita Shah',
  role: 'Platform Operations Lead',
  permissions: ['dashboard.view', 'catalog.manage', 'customers.view', 'analytics.view', 'settings.manage']
}

const navigation: NavigationItem[] = [
  {
    label: 'Overview',
    href: '/',
    description: 'Pulse, revenue, onboarding stats',
    permission: 'dashboard.view'
  },
  {
    label: 'Orders',
    href: '/orders',
    description: 'Fulfilment queue, returns, SLAs',
    permission: 'orders.view'
  },
  {
    label: 'Catalog',
    href: '/catalog',
    description: 'Products, collections, media',
    permission: 'catalog.manage'
  },
  {
    label: 'Customers',
    href: '/customers',
    description: 'Segments, loyalty, cohorts',
    permission: 'customers.view'
  },
  {
    label: 'Marketing',
    href: '/marketing',
    description: 'Automations, campaigns, journeys',
    permission: 'marketing.view'
  },
  {
    label: 'Settings',
    href: '/settings',
    description: 'Billing, staff, integrations',
    permission: 'settings.manage'
  }
]


function classNames(...inputs: Array<string | undefined | false | null>) {
  return inputs.filter(Boolean).join(' ')
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase())
    .slice(0, 2)
    .join('')
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<OperatorProfile>(defaultProfile)
  const [onboarding, setOnboarding] = useState<OnboardingCardState>({
    status: 'loading',
    message: 'Checking onboarding progress…'
  })
  const [onboardingNotifications, setOnboardingNotifications] = useState<NotificationItem[]>([])
  const [onboardingDetail, setOnboardingDetail] = useState<OnboardingResponse | null>(null)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [overviewStatus, setOverviewStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle')
  const [overviewMessage, setOverviewMessage] = useState<string | null>(null)

  const buildAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (typeof window !== 'undefined') {
      const token = window.localStorage.getItem('token')
      if (token) {
        headers.Authorization = `Bearer ${token}`
        if (process.env.NODE_ENV !== 'production') {
          headers['cf-access-jwt-assertion'] = token
        }
      } else if (process.env.NODE_ENV !== 'production') {
        headers['cf-access-jwt-assertion'] = 'dev-bypass'
      }
    }

    return headers
  }, [])

  useEffect(() => {
    initPosthog()

    if (typeof window === 'undefined') {
      return
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<OperatorProfile>
        setProfile((prev) => ({
          ...prev,
          ...parsed,
          permissions: Array.isArray(parsed?.permissions) && parsed.permissions.length > 0 ? (parsed.permissions as Permission[]) : prev.permissions
        }))
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultProfile))
      }
    } catch (error) {
      console.error('Unable to parse operator profile from storage', error)
    }
  }, [])

  useEffect(() => {
    if (!API_BASE) {
      setOnboarding({
        status: 'unavailable',
        message: 'Set NEXT_PUBLIC_API_URL to surface live onboarding progress.'
      })
      setOverviewStatus('error')
      setOverviewMessage('Set NEXT_PUBLIC_API_URL to surface dashboard metrics.')
      return
    }

    let active = true

    const fetchStatus = async () => {
      try {
        const data = await apiFetch<OnboardingResponse>(`${API_BASE}/v1/onboarding`, {
          headers: buildAuthHeaders(),
          credentials: 'include'
        })
        if (!active) return

        setOnboardingDetail(data)
        if (data.completed) {
          setOnboarding({
            status: 'complete',
            message: 'Onboarding complete — stores are ready to go live.'
          })
          setOnboardingNotifications([
            {
              id: 'onboarding-complete',
              title: 'Onboarding completed',
              detail: 'Celebrate launch prep with the merchant. Monitor sales momentum next.',
              tone: 'success'
            }
          ])
          capture('dashboard_onboarding_completed', {
            tenantId: data.tenantId,
            triggeredAt: new Date().toISOString()
          })
        } else {
          setOnboarding({
            status: 'needs-action',
            message: `Onboarding paused on step ${data.currentStep} of 6.`,
            currentStep: data.currentStep,
            totalSteps: 6
          })
          setOnboardingNotifications([
            {
              id: 'onboarding-reminder',
              title: `Finish onboarding step ${data.currentStep}`,
              detail: 'Resume the wizard to unlock go-live tasks and demo catalog seeding.',
              tone: 'warning',
              href: '/onboarding'
            }
          ])
          capture('dashboard_onboarding_needs_action', {
            tenantId: data.tenantId,
            currentStep: data.currentStep
          })
        }
      } catch (error) {
        console.error('Unable to load onboarding status', error)
        if (!active) return
        setOnboarding({
          status: 'unavailable',
          message: 'Unable to load onboarding progress right now. Try again shortly.'
        })
        setOnboardingDetail(null)
      }
    }

    const fetchOverview = async () => {
      setOverviewStatus('loading')
      setOverviewMessage(null)
      try {
        const overviewData = await apiFetch<DashboardOverview>(`${API_BASE}/v1/admin/dashboard/overview`, {
          headers: buildAuthHeaders(),
          credentials: 'include'
        })
        if (!active) return

        setOverview(overviewData)
        setOverviewStatus('ready')
        capture('dashboard_overview_loaded', {
          generatedAt: overviewData.generatedAt,
          metricCount: overviewData.metrics.length,
          notificationCount: overviewData.notifications.length
        })
      } catch (error) {
        console.error('Unable to load dashboard overview', error)
        if (!active) return
        setOverview(null)
        setOverviewStatus('error')
        setOverviewMessage('Unable to load dashboard metrics. Showing defaults.')
        capture('dashboard_overview_failed', {
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    fetchStatus()
    fetchOverview()

    return () => {
      active = false
    }
  }, [buildAuthHeaders])

  const permissions = useMemo(() => new Set(profile.permissions), [profile.permissions])
  const visibleNavigation = useMemo(
    () => navigation.filter((item) => !item.permission || permissions.has(item.permission)),
    [permissions]
  )

  const hiddenCount = navigation.length - visibleNavigation.length
  const operatorInitials = getInitials(profile.name)
  const greeting = getGreeting()

  const checklistItems = useMemo(() => {
    return onboardingSteps.map((label, index) => {
      const stepNumber = index + 1
      let state: 'done' | 'current' | 'pending' = 'pending'

      if (onboardingDetail?.completed) {
        state = 'done'
      } else if (onboardingDetail) {
        if (stepNumber < onboardingDetail.currentStep) {
          state = 'done'
        } else if (stepNumber === onboardingDetail.currentStep) {
          state = 'current'
        }
      }

      return { label, state, stepNumber }
    })
  }, [onboardingDetail])

  const metricsForDisplay = useMemo(() => {
    const source = overview?.metrics ?? FALLBACK_OVERVIEW.metrics
    return source.map((metric) => ({
      id: metric.id,
      label: metric.label,
      value: formatValue(metric.value, metric.format),
      rawValue: metric.value,
      delta: formatChange(metric.change),
      rawDelta: metric.change,
      trend: determineTrend(metric.change),
      subLabel: metric.helper ?? ''
    }))
  }, [overview])

  const funnelForDisplay = useMemo(() => {
    const source = overview?.funnel ?? FALLBACK_OVERVIEW.funnel
    return source.map((stage) => ({
      label: stage.label,
      value: formatValue(stage.value, stage.format ?? 'number'),
      conversion: stage.format === 'percent' ? formatChange(stage.change).replace(' vs prior period', '') : formatChange(stage.change),
      rawValue: stage.value,
      rawChange: stage.change
    }))
  }, [overview])

  const notifications = useMemo(() => {
    const base = overview?.notifications ?? FALLBACK_OVERVIEW.notifications
    return [...base, ...onboardingNotifications]
  }, [overview, onboardingNotifications])

  const activityItems = overview?.activity ?? FALLBACK_OVERVIEW.activity

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-lg shadow-black/20 backdrop-blur">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400">Merchant Operations</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-50">
              {greeting}, {profile.name.split(' ')[0] ?? 'there'}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-slate-300">
              Stay ahead of store health, provisioning telemetry, and onboarding progress. This overview mirrors the tools
              we ship to merchants – lean, fast, and focused on what moves revenue.
            </p>
            {onboarding.status === 'needs-action' && (
              <Link
                href="/onboarding"
                className="mt-5 inline-flex items-center rounded-full bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-400/50 transition hover:bg-emerald-400/25"
              >
                Resume onboarding
              </Link>
            )}
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-slate-800/60 bg-slate-950/80 px-4 py-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-lg font-semibold text-emerald-200">
              {operatorInitials || 'OP'}
            </span>
            <div>
              <p className="text-sm font-medium text-slate-100">{profile.name}</p>
              <p className="text-xs text-slate-400">{profile.role}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[260px,1fr]">
        <aside className="space-y-6">
          <nav className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Navigation</p>
            <ul className="mt-4 space-y-2">
              {visibleNavigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.href === '/' ? 'page' : undefined}
                    className={classNames(
                      'group block rounded-xl border border-transparent px-3 py-2 transition',
                      item.href === '/'
                        ? 'bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/30'
                        : 'hover:border-slate-700 hover:bg-slate-900/80'
                    )}
                  >
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-slate-400 transition group-hover:text-slate-300">{item.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
            {hiddenCount > 0 && (
              <p className="mt-4 text-xs text-slate-500">{hiddenCount} items hidden · request additional permissions.</p>
            )}
          </nav>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Onboarding</p>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <p>{onboarding.message}</p>
              {onboarding.status === 'needs-action' && (
                <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  <p className="font-semibold">Next steps</p>
                  <p>
                    Step {onboarding.currentStep} of {onboarding.totalSteps}. Complete the remaining checklist to unlock go-live tasks.
                  </p>
                </div>
              )}
            </div>
            {onboarding.status === 'complete' && (
              <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                All onboarding checklist items are complete. Monitor activation metrics over the next 7 days.
              </p>
            )}
          </div>
        </aside>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Onboarding checklist</p>
                <p className="text-xs text-slate-400">
                  Track the six-step launch flow. Progress syncs directly with the Store API.
                </p>
              </div>
              {onboarding.status === 'needs-action' && (
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                >
                  Resume wizard →
                </Link>
              )}
            </header>

            {onboarding.status === 'unavailable' ? (
              <p className="mt-4 text-xs text-slate-400">{onboarding.message}</p>
            ) : (
              <ol className="mt-4 grid gap-2 md:grid-cols-2">
                {checklistItems.map((item) => (
                  <li key={item.stepNumber}>
                    <Link
                      href="/onboarding"
                      className={classNames(
                        'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition cursor-pointer',
                        item.state === 'done' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20',
                        item.state === 'current' && 'border-sky-500/30 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20 ring-2 ring-sky-400/30',
                        item.state === 'pending' && 'border-slate-800 bg-slate-950/40 text-slate-200 hover:border-slate-700 hover:bg-slate-900/60'
                      )}
                      onClick={() => {
                        capture('dashboard_checklist_item_clicked', {
                          stepNumber: item.stepNumber,
                          stepLabel: item.label,
                          stepState: item.state
                        })
                      }}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-current text-xs font-semibold">
                        {item.state === 'done' ? '✓' : item.stepNumber}
                      </span>
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-xs text-slate-400">
                          {item.state === 'done' && 'Completed'}
                          {item.state === 'current' && 'In progress'}
                          {item.state === 'pending' && 'Pending'}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metricsForDisplay.map((card) => (
              <article
                key={card.label}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-sm shadow-black/10"
                data-metric-id={card.id}
                data-metric-value={card.rawValue}
                data-metric-delta={card.rawDelta}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{card.label}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-50">{card.value}</p>
                <p
                  className={classNames(
                    'mt-2 text-xs font-medium',
                    card.trend === 'up' && 'text-emerald-300',
                    card.trend === 'down' && 'text-amber-300',
                    card.trend === 'flat' && 'text-slate-400'
                  )}
                >
                  {card.delta}
                </p>
                <p className="mt-3 text-xs text-slate-400">{card.subLabel}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <header className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-100">Commerce funnel</p>
                <span className="text-xs text-slate-500">Last 7 days</span>
              </header>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                {funnelForDisplay.map((stage) => (
                  <li
                    key={stage.label}
                    className="flex items-center justify-between rounded-lg bg-slate-950/40 px-3 py-2"
                    data-funnel-stage={stage.label}
                    data-funnel-value={stage.rawValue}
                    data-funnel-change={stage.rawChange}
                  >
                    <span>{stage.label}</span>
                    <span className="text-right">
                      <span className="block font-semibold text-slate-100">{stage.value}</span>
                      <span className="text-xs text-emerald-300">{stage.conversion}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <header className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-100">Activity feed</p>
                <span className="text-xs text-slate-500">Platform telemetry</span>
              </header>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                {activityItems.map((item) => (
                  <li key={item.id} className="rounded-lg bg-slate-950/40 px-3 py-2">
                    <p className="font-medium text-slate-100">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Notification center</p>
                <p className="text-xs text-slate-400">Inventory alerts, onboarding reminders, and system nudges.</p>
              </div>
              <div className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-400">{notifications.length} open</div>
            </header>
            {overviewMessage && (
              <p className="mt-4 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                {overviewMessage}
              </p>
            )}
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className={classNames(
                    'flex flex-col justify-between rounded-xl border px-4 py-3 text-sm transition',
                    item.tone === 'warning' && 'border-amber-400/40 bg-amber-500/10 text-amber-100',
                    item.tone === 'info' && 'border-slate-700 bg-slate-950/50 text-slate-200',
                    item.tone === 'success' && 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs opacity-80">{item.detail}</p>
                  </div>
                  {item.href && (
                    <Link
                      href={item.href}
                      className="mt-3 inline-flex items-center text-xs font-semibold underline-offset-4 hover:underline"
                    >
                      Review
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  )
}
