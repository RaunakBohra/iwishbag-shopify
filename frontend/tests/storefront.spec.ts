import { expect, request, test } from '@playwright/test'

const TENANT_SLUG = process.env.PLAYWRIGHT_TENANT_SLUG ?? 'demo'
const API_BASE = process.env.NEXT_PUBLIC_API_URL

let readinessReason: string | null = null
let sampleProduct: {
  slug: string
  title: string
} | null = null

test.beforeAll(async () => {
  if (!API_BASE) {
    readinessReason = 'NEXT_PUBLIC_API_URL is not configured for storefront tests.'
    return
  }

  const context = await request.newContext()
  try {
    const response = await context.get(
      `${API_BASE.replace(/\/$/, '')}/public/v1/storefront/${TENANT_SLUG}/products?pageSize=1`
    )

    if (!response.ok()) {
      readinessReason = `Storefront API responded with ${response.status()}`
      return
    }

    const payload = (await response.json()) as {
      data?: Array<{ slug: string; title: string }>
    }

    const firstProduct = payload.data?.[0]

    if (!firstProduct) {
      readinessReason = 'No products available for storefront smoke tests.'
      return
    }

    sampleProduct = {
      slug: firstProduct.slug,
      title: firstProduct.title
    }
  } catch (error) {
    readinessReason = `Failed to reach storefront API: ${(error as Error).message}`
  } finally {
    await context.dispose()
  }
})

test.describe('Storefront experience', () => {
  test('renders product grid with summary', async ({ page }) => {
    test.skip(!!readinessReason, readinessReason ?? 'Storefront API unavailable')

    await page.goto(`/${TENANT_SLUG}/products`)

    await expect(page.getByRole('heading', { level: 1, name: /Explore products/i })).toBeVisible()
    await expect(page.getByRole('status')).toContainText(/Showing/i)

    if (sampleProduct) {
      await expect(
        page.getByRole('heading', { level: 3, name: new RegExp(sampleProduct.title, 'i') })
      ).toBeVisible()
    }
  })

  test('shows detail page for sampled product', async ({ page }) => {
    test.skip(!!readinessReason, readinessReason ?? 'Storefront API unavailable')
    test.skip(!sampleProduct, 'No product found for detail smoke test')

    const product = sampleProduct!

    await page.goto(`/${TENANT_SLUG}/products/${product.slug}`)

    await expect(page.getByRole('heading', { level: 1, name: new RegExp(product.title, 'i') })).toBeVisible()
    await expect(page.getByRole('button', { name: /Add to cart/i })).toBeVisible()
    await expect(page.getByText(/NPR/i).first()).toBeVisible()
  })

  test('completes cart checkout flow', async ({ page }) => {
    test.skip(!!readinessReason, readinessReason ?? 'Storefront API unavailable')
    test.skip(!sampleProduct, 'No product found for checkout flow')

    await page.context().clearCookies()
    await page.addInitScript(() => {
      try {
        window.localStorage?.clear()
        window.sessionStorage?.clear()
      } catch {
        // ignore storage clearing errors in isolated browsers
      }
    })

    const product = sampleProduct!

    await page.goto(`/${TENANT_SLUG}/products/${product.slug}`)

    await page.getByRole('button', { name: /Add to cart/i }).click()
    const cartButton = page.getByRole('button', { name: /^Cart\b/i })
    await expect(cartButton).toBeEnabled()
    await cartButton.click()
    await expect(page.getByRole('dialog', { name: /Shopping cart/i })).toBeVisible()

    const checkoutButton = page.getByRole('button', { name: /Go to checkout/i })
    await expect(checkoutButton).toBeEnabled({ timeout: 15000 })
    await checkoutButton.click()
    await page.waitForURL(`**/${TENANT_SLUG}/checkout`)

    await page.getByLabel('Email').fill('shopper@example.com')
    await page.getByLabel('Phone').fill('9800000000')
    await page.getByLabel('Full name').fill('Playwright Shopper')
    await page.getByLabel('Address line 1').fill('123 Checkout Lane')
    await page.getByLabel('City').fill('Kathmandu')
    await page.getByLabel('Postal code').fill('44600')

    // Select elements default to first option; ensure a deterministic district selection.
    await page.getByLabel('Province').selectOption({ index: 0 })
    await page.getByLabel('District').selectOption({ index: 0 })

    await Promise.all([
      page.waitForURL(`**/${TENANT_SLUG}/checkout/confirmation/**`, { timeout: 30000 }),
      page.getByRole('button', { name: /Continue to payment/i }).click()
    ])

    await expect(page.getByRole('heading', { level: 1, name: /Checkout status/i })).toBeVisible()
    await page.getByRole('button', { name: /Complete payment/i }).click()
    await expect(page.getByText('Order submitted successfully!')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Cash on delivery/i)).toBeVisible()
  })
})
