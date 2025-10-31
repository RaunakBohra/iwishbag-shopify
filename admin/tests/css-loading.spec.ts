import { test, expect } from '@playwright/test'

test.describe('Admin Panel CSS and Asset Loading', () => {
  test('should load dashboard page with proper CSS styling', async ({ page }) => {
    await page.goto('http://localhost:3000')

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')

    // Check if main heading exists
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()

    // Check computed styles to ensure CSS is loaded
    const header = page.locator('header').first()
    const backgroundColor = await header.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    )

    // Verify that background color is set (not default/transparent)
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(backgroundColor).not.toBe('transparent')

    console.log('✅ Dashboard header background color:', backgroundColor)

    // Check for navigation elements
    const navigation = page.locator('nav')
    await expect(navigation).toBeVisible()

    // Check border radius is applied (glassmorphic design)
    const borderRadius = await header.evaluate((el) =>
      window.getComputedStyle(el).borderRadius
    )
    expect(borderRadius).not.toBe('0px')
    console.log('✅ Header border radius:', borderRadius)

    // Screenshot for visual verification
    await page.screenshot({ path: 'admin/tests/screenshots/dashboard-loaded.png', fullPage: true })
  })

  test('should load onboarding page with CSS', async ({ page }) => {
    await page.goto('http://localhost:3000/onboarding')
    await page.waitForLoadState('networkidle')

    // Check page heading
    const heading = page.locator('h1')
    await expect(heading).toContainText(/onboarding/i)

    // Check if styles are applied
    const container = page.locator('.onboarding-container, main').first()
    const padding = await container.evaluate((el) =>
      window.getComputedStyle(el).padding
    )

    expect(padding).not.toBe('0px')
    console.log('✅ Onboarding container padding:', padding)

    await page.screenshot({ path: 'admin/tests/screenshots/onboarding-loaded.png', fullPage: true })
  })

  test('should load catalog page with CSS and table styling', async ({ page }) => {
    await page.goto('http://localhost:3000/catalog')
    await page.waitForLoadState('networkidle')

    // Check heading
    const heading = page.locator('h1')
    await expect(heading).toContainText(/products/i)

    // Check if table or grid exists
    const catalogSection = page.locator('section, table').first()
    await expect(catalogSection).toBeVisible()

    // Check border styling
    const borderColor = await catalogSection.evaluate((el) =>
      window.getComputedStyle(el).borderColor
    )

    console.log('✅ Catalog section border color:', borderColor)

    await page.screenshot({ path: 'admin/tests/screenshots/catalog-loaded.png', fullPage: true })
  })

  test('should load inventory page with proper styling', async ({ page }) => {
    await page.goto('http://localhost:3000/inventory')
    await page.waitForLoadState('networkidle')

    // Check heading
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()

    // Verify table styling if present
    const section = page.locator('section').first()
    const bgColor = await section.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    )

    expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
    console.log('✅ Inventory section background:', bgColor)

    await page.screenshot({ path: 'admin/tests/screenshots/inventory-loaded.png', fullPage: true })
  })

  test('should check if all CSS resources loaded without errors', async ({ page }) => {
    const failedResources: string[] = []

    page.on('response', response => {
      const url = response.url()
      const status = response.status()

      // Check for CSS files and font files
      if (url.includes('.css') || url.includes('font') || url.includes('/_next/')) {
        if (status >= 400) {
          failedResources.push(`${url} (status: ${status})`)
        } else {
          console.log(`✅ Resource loaded: ${url.split('/').pop()}`)
        }
      }
    })

    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')

    // Check that no resources failed
    expect(failedResources).toHaveLength(0)

    if (failedResources.length > 0) {
      console.error('❌ Failed resources:', failedResources)
    }
  })
})

test.describe('Storefront CSS and Asset Loading', () => {
  test('should load products page with proper styling', async ({ page }) => {
    // Using demo-tenant as per the git status
    await page.goto('http://localhost:3001/demo-tenant/products')
    await page.waitForLoadState('networkidle')

    // Check heading
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()

    // Check if product grid has styling
    const grid = page.locator('.grid, [class*="grid"]').first()

    if (await grid.isVisible()) {
      const display = await grid.evaluate((el) =>
        window.getComputedStyle(el).display
      )
      console.log('✅ Product grid display:', display)
      expect(display).toContain('grid')
    }

    await page.screenshot({ path: 'admin/tests/screenshots/storefront-products.png', fullPage: true })
  })

  test('should verify storefront CSS resources load', async ({ page }) => {
    const cssResources: string[] = []

    page.on('response', response => {
      const url = response.url()
      if (url.includes('.css') || url.includes('/_next/static/')) {
        cssResources.push(url)
        console.log(`✅ Storefront resource: ${url.split('/').pop()}`)
      }
    })

    await page.goto('http://localhost:3001/demo-tenant/products')
    await page.waitForLoadState('networkidle')

    // Verify at least some Next.js assets loaded
    expect(cssResources.length).toBeGreaterThan(0)
  })
})
