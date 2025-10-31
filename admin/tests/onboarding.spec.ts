import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function mockOnboardingApi(page: Page) {
  const state = {
    tenantId: 'tenant_onboarding',
    currentStep: 1,
    completed: false,
    steps: {} as Record<string, unknown>
  }

  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'playwright-token')
  })

  await page.route('**/v1/onboarding', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        json: { data: state }
      })
      return
    }

    const payload = JSON.parse(route.request().postData() ?? '{}')
    const stepNumber = Number(payload.step ?? state.currentStep)
    state.steps[String(stepNumber)] = payload.data ?? {}

    if (payload.completed) {
      state.completed = true
      state.currentStep = 6
    } else {
      state.completed = false
      state.currentStep = Math.min(6, stepNumber + 1)
    }

    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      json: { data: state }
    })
  })
}

test.describe('Onboarding wizard', () => {
  test('surfaces an error message when the API fails', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('token', 'playwright-token')
    })

    await page.route('**/v1/onboarding', async (route) => {
      await route.fulfill({ status: 500, body: 'internal error' })
    })

    await page.goto('/onboarding')

    await expect(page.getByText('Unable to load onboarding status. Please try again.')).toBeVisible()
  })

  test('completes the onboarding flow and resumes mid-progress', async ({ page }) => {
    await mockOnboardingApi(page)

    await page.goto('/onboarding')

    await expect(page.getByRole('heading', { name: 'Store details' })).toBeVisible()

    await page.getByLabel('Store name').fill('Everest Outfitters')
    await page.getByLabel('Contact email').fill('ops@everest.test')
    await page.getByRole('button', { name: /Save & Continue/i }).click()
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible()

    await page.getByRole('button', { name: /Save & Continue/i }).click()
    await expect(page.getByRole('heading', { name: 'Shipping' })).toBeVisible()

    await page.getByLabel('Shipping preferences').fill('Kathmandu next-day via Pathao; nationwide 3-5 days.')
    await page.getByRole('button', { name: /Save & Continue/i }).click()
    await expect(page.getByRole('heading', { name: 'First product' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'First product' })).toBeVisible()

    await page.getByLabel('Product name').fill('Everest Down Jacket')
    await page.getByRole('button', { name: /Save & Continue/i }).click()
    await expect(page.getByRole('heading', { name: 'Theme' })).toBeVisible()

    await page.getByRole('radio', { name: 'Classic Shop' }).check()
    await page.getByRole('button', { name: /Save & Continue/i }).click()
    await expect(page.getByRole('heading', { name: 'Launch checklist' })).toBeVisible()

    await page.getByRole('checkbox', { name: /I reviewed my store configuration/i }).check()
    await page.getByRole('button', { name: /Finish onboarding/i }).click()

    await expect(page.getByText('Store onboarding complete')).toBeVisible()
  })
})
