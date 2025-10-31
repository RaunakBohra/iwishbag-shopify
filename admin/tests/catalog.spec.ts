import { expect, test } from '@playwright/test'
import { Buffer } from 'buffer'

interface ProductFixture {
  id: string
  title: string
  description?: string
  price: number
  sku?: string
  inventory?: number
  status: 'ACTIVE' | 'DRAFT'
  variants: unknown[]
  images: unknown[]
  createdAt: string
  updatedAt: string
}

const now = new Date().toISOString()

test.describe('Catalog management', () => {
  test('lists products, filters, and toggles status', async ({ page }) => {
    const products: ProductFixture[] = [
      {
        id: 'prod_active',
        title: 'Everest Jacket',
        description: 'Flagship bestseller',
        price: 22000,
        sku: 'EVJ-001',
        inventory: 28,
        status: 'ACTIVE',
        variants: [],
        images: [],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'prod_draft',
        title: 'Annapurna Parka',
        description: 'Coming soon drop',
        price: 28000,
        sku: 'ANP-001',
        inventory: 0,
        status: 'DRAFT',
        variants: [],
        images: [],
        createdAt: now,
        updatedAt: now
      }
    ]

    await page.route('**/v1/products', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          json: { data: products }
        })
        return
      }

      const url = route.request().url()
      if (route.request().method() === 'PATCH' && url.includes('/prod_draft')) {
        products[1] = { ...products[1], status: 'ACTIVE', updatedAt: new Date().toISOString() }
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          json: { data: products[1] }
        })
        return
      }

      await route.continue()
    })

    await page.goto('/catalog')

    await expect(page.getByText('Everest Jacket')).toBeVisible()
    await expect(page.getByText('Annapurna Parka')).toBeVisible()

    await page.getByPlaceholder('Search by title or SKU').fill('annapurna')
    await expect(page.getByText('Everest Jacket')).toBeHidden()
    await expect(page.getByText('Annapurna Parka')).toBeVisible()

    await page.getByPlaceholder('Search by title or SKU').fill('')
    await page.getByRole('combobox').selectOption('ACTIVE')
    await expect(page.getByText('Everest Jacket')).toBeVisible()
    await expect(page.getByText('Annapurna Parka')).toBeHidden()

    await page.getByRole('combobox').selectOption('ALL')
    await expect(
      page
        .getByRole('row', { name: /Annapurna Parka/ })
        .getByText('Draft', { exact: true })
    ).toBeVisible()

    await expect(
      page
        .getByRole('row', { name: /Annapurna Parka/ })
        .getByRole('button', { name: 'Publish' })
    ).toBeVisible()
  })

  test('creates a product and manages variants and media', async ({ page }) => {
    const products: ProductFixture[] = []
    const variants: { [productId: string]: any[] } = {}
    const images: { [productId: string]: any[] } = {}

    await page.route('**/v1/products', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          json: { data: products }
        })
        return
      }

      if (route.request().method() === 'POST') {
        const payload = JSON.parse(route.request().postData() ?? '{}')
        const created: ProductFixture = {
          id: 'prod_new',
          title: payload.title,
          description: payload.description ?? '',
          price: payload.price,
          sku: payload.sku,
          inventory: payload.inventory,
          status: payload.status ?? 'DRAFT',
          variants: [],
          images: [],
          createdAt: now,
          updatedAt: now
        }
        products.push(created)
        await route.fulfill({
          status: 201,
          headers: { 'content-type': 'application/json' },
          json: { data: created }
        })
        return
      }

      await route.continue()
    })

    await page.route('**/v1/product-variants/prod_new', async (route) => {
      const store = (variants['prod_new'] = variants['prod_new'] || [])
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          json: { data: store }
        })
        return
      }

      if (route.request().method() === 'POST') {
        const payload = JSON.parse(route.request().postData() ?? '{}')
        const variant = {
          id: `var-${store.length + 1}`,
          name: payload.name,
          sku: payload.sku,
          price: payload.price ?? null,
          inventory: payload.inventory ?? 0
        }
        store.push(variant)
        await route.fulfill({
          status: 201,
          headers: { 'content-type': 'application/json' },
          json: { data: variant }
        })
        return
      }

      if (route.request().method() === 'PATCH') {
        const [, , , variantId] = route.request().url().split('/')
        const payload = JSON.parse(route.request().postData() ?? '{}')
        const storeEntry = store.find((item) => item.id === variantId)
        Object.assign(storeEntry, payload)
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          json: { data: storeEntry }
        })
        return
      }

      if (route.request().method() === 'DELETE') {
        const [, , , variantId] = route.request().url().split('/')
        const index = store.findIndex((item) => item.id === variantId)
        if (index !== -1) {
          store.splice(index, 1)
        }
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          json: { data: { success: true } }
        })
        return
      }

      await route.continue()
    })

    await page.route('**/v1/product-media/prod_new', async (route) => {
      const store = (images['prod_new'] = images['prod_new'] || [])
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          json: { data: store }
        })
        return
      }

      if (route.request().method() === 'POST') {
        const image = {
          id: `img-${store.length + 1}`,
          url: `https://cdn.test/image-${store.length + 1}.jpg`,
          alt: null,
          position: store.length
        }
        store.push(image)
        await route.fulfill({
          status: 201,
          headers: { 'content-type': 'application/json' },
          json: { data: image }
        })
        return
      }

      if (route.request().method() === 'DELETE') {
        const [, , , imageId] = route.request().url().split('/')
        const index = store.findIndex((item) => item.id === imageId)
        if (index !== -1) {
          store.splice(index, 1)
        }
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'application/json' },
          json: { data: { success: true } }
        })
        return
      }

      await route.continue()
    })

    await page.goto('/catalog/new')

    await page.getByPlaceholder('Everest Down Jacket').fill('Langtang Backpack')
    await page.getByPlaceholder('Highlight materials, fit, and story.').fill('Modular daypack with quick access pockets.')
    await page.getByLabel('Price (NPR)').fill('9500')
    await page.getByLabel('Inventory').fill('12')
    await page.getByLabel('SKU').fill('LBP-001')

    await page.getByRole('button', { name: 'Create product' }).click()

    await expect(page).toHaveURL(/\/catalog\/prod_new$/)

    await expect(page.getByText('Variant builder')).toBeVisible()

    await page.getByPlaceholder('Large / Nepal').fill('Default')
    await page.getByPlaceholder('SKU-001-L').fill('LBP-001-DEF')
    await page.getByLabel('Price override').fill('9600')
    await page.getByLabel('Inventory', { exact: false }).last().fill('12')
    await page.getByRole('button', { name: 'Add variant' }).click()

    await expect(page.getByText('Variant added')).toBeVisible()
    await expect(page.getByText('Default')).toBeVisible()

    await page.setInputFiles('input[type="file"]', {
      name: 'image.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9])
    })

    await expect(page.getByText('Image uploaded')).toBeVisible()
    await expect(page.getByText('Untitled image')).toBeVisible()
  })
})
