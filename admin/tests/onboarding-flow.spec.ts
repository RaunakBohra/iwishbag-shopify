import { test, expect } from '@playwright/test'

test.describe('Onboarding Wizard Flow', () => {
  test('completes full 6-step onboarding wizard', async ({ page }) => {
    // Set auth token in localStorage before navigation
    await page.goto('http://localhost:3000')
    await page.evaluate(() => {
      localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0ZW5hbnRJZCI6IjM5Zjc4MzhlLTNjNDMtNGQwOS04M2UxLTc4ZWE3NzZmNDVmZCIsInJvbGUiOiJPV05FUiIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInN1YiI6ImNtZ3ZseG43YjAwMHZsZ3JtejYzMnNhbHoiLCJleHAiOjE3NjA3NTIzMjF9.1DA7v40Rmijw--lu3T-DVjr35dIcKJBDa3UuN2vaMrg')
    })

    // Navigate to onboarding page
    await page.goto('http://localhost:3000/onboarding')
    await page.waitForLoadState('networkidle')

    // Should show Step 1: Store Details
    await expect(page.locator('h2')).toContainText('Store details')
    
    // Fill Step 1
    await page.getByPlaceholder(/himalayan threads/i).fill('Test E-Commerce Store')
    await page.getByPlaceholder(/ops@yourstore.com/i).fill('admin@teststore.np')
    await page.getByRole('button', { name: /save & continue/i }).click()
    
    // Wait for Step 2
    await page.waitForTimeout(1000)
    await expect(page.locator('h2')).toContainText('Payments')
    
    // Select payment provider
    await page.locator('select').selectOption('khalti')
    await page.getByRole('button', { name: /save & continue/i }).click()
    
    // Wait for Step 3
    await page.waitForTimeout(1000)
    await expect(page.locator('h2')).toContainText('Shipping')
    
    // Fill shipping details
    await page.locator('textarea').fill('Kathmandu Valley next-day delivery via Pathao. Nationwide 3-5 days via Nepal Post.')
    await page.getByRole('button', { name: /save & continue/i }).click()
    
    // Wait for Step 4
    await page.waitForTimeout(1000)
    await expect(page.locator('h2')).toContainText('First product')
    
    // Add product name
    await page.getByPlaceholder(/everest down jacket/i).fill('Nepali Pashmina Shawl')
    await page.getByRole('button', { name: /save & continue/i }).click()
    
    // Wait for Step 5
    await page.waitForTimeout(1000)
    await expect(page.locator('h2')).toContainText('Theme')
    
    // Select theme
    await page.locator('input[value="classic"]').check()
    await page.getByRole('button', { name: /save & continue/i }).click()
    
    // Wait for Step 6
    await page.waitForTimeout(1000)
    await expect(page.locator('h2')).toContainText('Launch checklist')
    
    // Accept terms and complete
    await page.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: /finish onboarding/i }).click()
    
    // Wait for completion message
    await page.waitForTimeout(2000)
    await expect(page.locator('h1')).toContainText(/store onboarding complete/i)
    
    // Take screenshot of completion
    await page.screenshot({ path: 'tests/screenshots/onboarding-complete.png', fullPage: true })
  })
})
