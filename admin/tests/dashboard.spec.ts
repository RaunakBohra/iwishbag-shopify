import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const OVERVIEW_FIXTURE = {
  metrics: [
    {
      id: 'revenue',
      label: 'Weekly revenue',
      value: 520000,
      change: 12.5,
      format: 'currency',
      helper: 'Last 7 days vs prior week'
    },
    {
      id: 'fulfilled-orders',
      label: 'Orders fulfilled',
      value: 188,
      change: 6.1,
      format: 'number',
      helper: 'Completed orders in the last 7 days'
    },
    {
      id: 'return-rate',
      label: 'Return rate',
      value: 1.1,
      change: -0.3,
      format: 'percent',
      helper: 'Returns vs total orders (7 days)'
    },
    {
      id: 'active-stores',
      label: 'Active stores',
      value: 74,
      change: 9.0,
      format: 'number',
      helper: 'Live merchants across the platform'
    }
  ],
  funnel: [
    { label: 'Sessions', value: 13420, change: 4.8 },
    { label: 'Carts created', value: 1189, change: 5.5 },
    { label: 'Checkouts', value: 812, change: 6.4 },
    { label: 'Conversion rate', value: 6.1, change: 0.4, format: 'percent' }
  ],
  notifications: [
    {
      id: 'low-stock-scarf',
      title: 'Low stock · Heritage Cashmere Scarf',
      detail: '4 units remaining · Everest Outfitters',
      tone: 'warning'
    },
    {
      id: 'supplier-update',
      title: 'Supplier delay · Organic Honey 500g',
      detail: 'Inbound shipment ETA extended by 1 day',
      tone: 'info'
    }
  ],
  activity: [
    {
      id: 'audit-1',
      title: 'tenant.provisioning.notifications.seeded',
      detail: 'System · Daraz Imports',
      tone: 'info',
      timestamp: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 'audit-2',
      title: 'tenant.subscription.plan.upgraded',
      detail: 'Aditi Sharma · Himalayan Threads',
      tone: 'info',
      timestamp: '2024-01-02T00:00:00.000Z'
    }
  ],
  generatedAt: '2024-01-03T00:00:00.000Z'
}

const ONBOARDING_STATE = {
  tenantId: 'tenant_playwright',
  currentStep: 3,
  completed: false,
  steps: {}
}

async function mockDashboardApi(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'playwright-token')
  })

  await page.route('**/v1/admin/dashboard/overview', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      json: { data: OVERVIEW_FIXTURE }
    })
  })

  await page.route('**/v1/onboarding', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        json: { data: ONBOARDING_STATE }
      })
      return
    }

    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      json: { data: ONBOARDING_STATE }
    })
  })
}

test.describe('Merchant dashboard', () => {
  test('renders API-driven metrics and onboarding status', async ({ page }) => {
    await mockDashboardApi(page)
    await page.goto('/')

    await expect(page.getByText('Onboarding checklist')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Resume onboarding' })).toBeVisible()

    await expect(page.getByText('NPR 520,000')).toBeVisible()
    await expect(page.getByText('Orders fulfilled')).toBeVisible()
    await expect(page.getByText('Low stock · Heritage Cashmere Scarf')).toBeVisible()
  })

  test('captures dashboard visual snapshot', async ({ page }) => {
    await mockDashboardApi(page)
    await page.goto('/')

    await expect(page).toHaveScreenshot('dashboard-overview.png', { fullPage: true })
  })
})
