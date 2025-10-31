# Frontend API Calls Reference

## Admin Dashboard API Calls

### Dashboard Page (`/admin/app/page.tsx`)

| Line | Endpoint | Method | Purpose | Auth |
|------|----------|--------|---------|------|
| 349 | `/v1/onboarding` | GET | Get onboarding status | Bearer |
| 409 | `/v1/admin/dashboard/overview` | GET | Get dashboard metrics | Bearer |

**Example Code:**
```javascript
const data = await apiFetch<OnboardingResponse>(`${API_BASE}/v1/onboarding`, {
  headers: buildAuthHeaders(),
  credentials: 'include'
})
```

**Headers Sent:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`
- `cf-access-jwt-assertion: {token}` (dev only)

---

### Catalog Page (`/admin/app/catalog/page.tsx`)

| Line | Endpoint | Method | Purpose | Auth |
|------|----------|--------|---------|------|
| 86 | `/v1/products` | GET | List all products | Bearer |
| 139 | `/v1/products/:productId` | PATCH | Update product status | Bearer |
| 175 | `/v1/products/:productId` | PATCH | Bulk update status | Bearer |
| 220 | `/v1/products/:productId` | DELETE | Delete product | Bearer |

**Example Code:**
```javascript
// Single product update
await apiFetch(`/v1/products/${productId}`, {
  method: 'PATCH',
  body: { status: nextStatus }
})

// Bulk operations
await Promise.all(
  Array.from(selectedIds).map((productId) =>
    apiFetch(`/v1/products/${productId}`, {
      method: 'PATCH',
      body: { status: targetStatus }
    })
  )
)
```

---

### Inventory Page (`/admin/app/inventory/page.tsx`)

| Line | Endpoint | Method | Purpose | Auth |
|------|----------|--------|---------|------|
| 74 | `/v1/inventory/levels` | GET | Get inventory levels | Bearer |
| 87 | `/v1/inventory/adjustments` | GET | Get adjustment history | Bearer |

**Example Code:**
```javascript
const response = await apiFetch<PaginatedResponse<InventoryLevel[]>>('/v1/inventory/levels')
const levels = response.data

const adjustments = await apiFetch<PaginatedResponse<InventoryAdjustment[]>>('/v1/inventory/adjustments')
```

**Response Format:**
```typescript
{
  data: InventoryLevel[],
  meta: {
    page: number,
    pageSize: number,
    total: number,
    hasNextPage: boolean
  }
}
```

---

### Onboarding Page (`/admin/app/onboarding/page.tsx`)

| Line | Endpoint | Method | Purpose | Auth |
|------|----------|--------|---------|------|
| 68 | `/v1/onboarding` | GET | Get current step | Bearer |
| 164 | `/v1/onboarding` | POST | Submit step data | Bearer |

**Example Code - GET:**
```javascript
const response = await fetch(`${API_BASE}/v1/onboarding`, {
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  },
  credentials: 'include'
})
const body = (await response.json()) as { data: StatusResponse }
```

**Example Code - POST:**
```javascript
const payload = {
  step: currentStep,
  data,
  completed: data.completed === true
}

const response = await fetch(`${API_BASE}/v1/onboarding`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  },
  credentials: 'include',
  body: JSON.stringify(payload)
})
```

---

## Frontend Storefront API Calls

### Products Page (`/frontend/app/[tenant]/products/page.tsx`)

| Line | Endpoint | Method | Purpose | Auth |
|------|----------|--------|---------|------|
| 264 | `/public/v1/storefront/{tenant}/products` | GET | List products | None |

**Query Parameters:**
```typescript
page=1
pageSize=24
q={search query}        // optional
sort=relevance|price_asc|price_desc|newest
inStock=true|false
tags=tag1&tags=tag2
collections={collectionId}
priceMin={number}
priceMax={number}
```

**Example Code:**
```typescript
const apiParams = new URLSearchParams({ page: String(page), pageSize: '24' })
if (q) apiParams.set('q', q)
if (sort) apiParams.set('sort', sort)
if (inStock) apiParams.set('inStock', 'true')

const data = await fetchStorefrontProducts(tenant, apiParams)
```

**Response Format:**
```typescript
{
  data: StorefrontProduct[],
  meta: {
    page: number,
    pageSize: number,
    total: number,
    hasNextPage: boolean,
    facets: {
      // Filter facets for UI
      [key: string]: { value: string; count: number }[]
    }
  }
}
```

---

### Product Detail Page (`/frontend/app/[tenant]/products/[productSlug]/page.tsx`)

| Line | Endpoint | Method | Purpose | Auth |
|------|----------|--------|---------|------|
| 120 | `/public/v1/storefront/{tenant}/products?q={slug}` | GET | Get specific product | None |

**Example Code:**
```typescript
const result = await fetchStorefrontProductBySlug(tenantSlug, productSlug)
// Internally: searchParams with q={productSlug}
```

---

### Checkout Page (`/frontend/app/[tenant]/checkout/page.tsx`)

| Line | Endpoint | Method | Purpose | Auth |
|------|----------|--------|---------|------|
| 92 | `/public/v1/storefront/{tenant}/cart/checkout` | POST | Begin checkout | Session |

**Example Code:**
```typescript
const result = await beginCheckout({
  email: form.email,
  phone: form.phone,
  shippingAddress: {
    fullName: form.fullName,
    addressLine1: form.addressLine1,
    addressLine2: form.addressLine2,
    city: form.city,
    province: form.province,
    postalCode: form.postalCode
  },
  billingAddress: {...},
  shippingMethod: {
    id: 'standard' | 'express',
    label: 'Standard (3-5 days)' | 'Express (1-2 days)',
    amount: 0 | 299  // in NPR
  }
})
```

---

## Cart Client Functions

### File: `/frontend/lib/cart-client.ts`

| Function | Endpoint | Method | Purpose |
|----------|----------|--------|---------|
| `fetchCart()` | `/public/v1/storefront/{tenant}/cart` | GET | Get current cart |
| `addCartItem()` | `/public/v1/storefront/{tenant}/cart/items` | POST | Add item to cart |
| `updateCartItem()` | `/public/v1/storefront/{tenant}/cart/items` | PATCH | Update item quantity |
| `removeCartItem()` | `/public/v1/storefront/{tenant}/cart/items/{id}` | DELETE | Remove item |
| `clearCart()` | `/public/v1/storefront/{tenant}/cart/clear` | POST | Clear entire cart |
| `beginCheckout()` | `/public/v1/storefront/{tenant}/cart/checkout` | POST | Start checkout |

**All send header:** `x-cart-session: {sessionToken}`

---

## Authentication Details

### Admin Dashboard Token Management

**Token Storage:** `localStorage.getItem('token')`

**Header Building:**
```typescript
function buildAuthHeaders() {
  const token = window.localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json' }
  
  if (token) {
    headers.Authorization = `Bearer ${token}`
    if (process.env.NODE_ENV !== 'production') {
      headers['cf-access-jwt-assertion'] = token
    }
  } else if (process.env.NODE_ENV !== 'production') {
    headers['cf-access-jwt-assertion'] = 'dev-bypass'
  }
  
  return headers
}
```

### Storefront Cart Token Management

**Token Storage:** `sessionStorage.getItem('storefront.cart.token')`

**Header Building:**
```typescript
function readStoredToken() {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to read cart token', error)
    return null
  }
}

const sessionToken = readStoredToken()
if (sessionToken) {
  headers.set('x-cart-session', sessionToken)
}
```

---

## Error Handling

### Admin Dashboard

```typescript
class ApiError extends Error {
  status: number
  details: unknown
}

try {
  const data = await apiFetch<Type>('/v1/endpoint')
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`Error ${error.status}: ${error.message}`, error.details)
  }
}
```

### Frontend Storefront

```typescript
class StorefrontFetchError extends Error {
  cause?: unknown
}

class StorefrontNotFoundError extends Error {}

try {
  const data = await fetchStorefrontProducts(tenant, params)
} catch (error) {
  if (error instanceof StorefrontNotFoundError) {
    // 404 handling
  } else if (error instanceof StorefrontFetchError) {
    // Fetch error handling
  }
}
```

---

## Configuration

### Required Environment Variables

```bash
# Both admin and frontend need this
NEXT_PUBLIC_API_URL=http://localhost:8787

# Frontend also uses
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_STATUS_PAGE_URL=https://status.iwishbag.store

# Admin also uses
ALLOW_DEV_ACCESS=true
```

### Base URL Resolution

```typescript
// Admin
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')
// Removes trailing slash if present

// Frontend
function getApiBase() {
  const base = process.env.NEXT_PUBLIC_API_URL
  if (!base) throw new Error('NEXT_PUBLIC_API_URL is not configured')
  return base.replace(/\/$/, '')
}
```

---

## Testing

### Playwright Configuration

```typescript
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8787'
```

Tests default to `http://127.0.0.1:8787` if `NEXT_PUBLIC_API_URL` not set.

---

**Last Updated:** October 17, 2025
**API Version:** v1 (Admin), public v1 (Storefront)
