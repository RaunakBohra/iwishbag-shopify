import { test, expect } from '@playwright/test'

test.describe('Automated Onboarding Flow', () => {
  test('completes full onboarding with screenshots', async ({ page }) => {
    // Register a fresh user to get a clean onboarding state
    const timestamp = Date.now()
    const email = `onboarding-test-${timestamp}@example.com`

    const registerResponse = await page.request.post('http://localhost:8787/v1/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email,
        password: 'testpass123',
        firstName: 'Test',
        lastName: 'User',
        storeName: 'Test Store'
      }
    })

    expect(registerResponse.ok()).toBeTruthy()
    const registerData = await registerResponse.json()
    const token = registerData.data.accessToken
    const refreshToken = registerData.data.refreshToken
    const user = registerData.data.user
    const tenant = registerData.data.tenant

    console.log(`✅ Registered new user: ${email}`)

    // Set auth tokens and user data in localStorage before navigation
    await page.goto('http://localhost:3000')
    await page.evaluate(({ authToken, refToken, userData, tenantData }) => {
      localStorage.setItem('token', authToken)
      localStorage.setItem('refreshToken', refToken)
      localStorage.setItem('user', JSON.stringify(userData))
      localStorage.setItem('tenant', JSON.stringify(tenantData))
    }, { authToken: token, refToken: refreshToken, userData: user, tenantData: tenant })

    // Navigate to onboarding page
    await page.goto('http://localhost:3000/onboarding')
    await page.waitForLoadState('networkidle')

    // Take screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/step-0-initial.png', fullPage: true })
    console.log('✅ Screenshot: Initial onboarding page')

    // Step 1: Store Details
    await expect(page.locator('h2')).toContainText('Store details')
    await page.getByPlaceholder(/himalayan threads/i).fill('Test E-Commerce Store')
    await page.getByPlaceholder(/ops@yourstore.com/i).fill('admin@teststore.np')
    await page.screenshot({ path: 'tests/screenshots/step-1-filled.png', fullPage: true })
    console.log('✅ Screenshot: Step 1 filled')

    await page.getByRole('button', { name: /save & continue/i }).click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'tests/screenshots/step-2-payments.png', fullPage: true })
    console.log('✅ Advanced to Step 2: Payments')

    // Step 2: Payments
    await expect(page.locator('h2')).toContainText('Payments')
    await page.locator('select').selectOption('khalti')
    await page.getByRole('button', { name: /save & continue/i }).click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'tests/screenshots/step-3-shipping.png', fullPage: true })
    console.log('✅ Advanced to Step 3: Shipping')

    // Step 3: Shipping
    await expect(page.locator('h2')).toContainText('Shipping')
    await page.locator('textarea').fill('Kathmandu Valley next-day delivery via Pathao. Nationwide 3-5 days via Nepal Post.')
    await page.getByRole('button', { name: /save & continue/i }).click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'tests/screenshots/step-4-product.png', fullPage: true })
    console.log('✅ Advanced to Step 4: First Product')

    // Step 4: First Product
    await expect(page.locator('h2')).toContainText('First product')
    await page.getByPlaceholder(/everest down jacket/i).fill('Nepali Pashmina Shawl')
    await page.getByRole('button', { name: /save & continue/i }).click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'tests/screenshots/step-5-theme.png', fullPage: true })
    console.log('✅ Advanced to Step 5: Theme')

    // Step 5: Theme
    await expect(page.locator('h2')).toContainText('Theme')
    await page.locator('input[value="classic"]').check()
    await page.getByRole('button', { name: /save & continue/i }).click()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'tests/screenshots/step-6-checklist.png', fullPage: true })
    console.log('✅ Advanced to Step 6: Launch Checklist')

    // Step 6: Launch Checklist
    await expect(page.locator('h2')).toContainText('Launch checklist')
    await page.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: /finish onboarding/i }).click()

    // Wait for completion
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'tests/screenshots/step-7-complete.png', fullPage: true })
    console.log('✅ Onboarding completed!')

    // Verify completion
    await expect(page.getByRole('heading', { name: /store onboarding complete/i })).toBeVisible()

    console.log('\n🎉 All steps completed successfully!')
    console.log('📸 Screenshots saved to tests/screenshots/')
  })
})
