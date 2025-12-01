export type Permission =
  | 'dashboard.view'
  | 'orders.view'
  | 'catalog.manage'
  | 'customers.view'
  | 'marketing.view'
  | 'analytics.view'
  | 'settings.manage'

export interface OperatorProfile {
  name: string
  role: string
  permissions: Permission[]
}

export type MetricFormat = 'currency' | 'number' | 'percent'

export interface MetricSummary {
  id: string
  label: string
  value: number
  change: number
  format?: MetricFormat
  helper?: string
}

export interface FunnelSummary {
  label: string
  value: number
  change: number
  format?: MetricFormat
}

export type ActivityTone = 'warning' | 'info' | 'success'

export interface NotificationItem {
  id: string
  title: string
  detail: string
  tone: ActivityTone
  href?: string
}

export interface ActivityItem {
  id: string
  title: string
  detail: string
  tone: ActivityTone
  timestamp?: string
}

export interface DashboardOverview {
  metrics: MetricSummary[]
  funnel: FunnelSummary[]
  notifications: NotificationItem[]
  activity: ActivityItem[]
  generatedAt: string
}
