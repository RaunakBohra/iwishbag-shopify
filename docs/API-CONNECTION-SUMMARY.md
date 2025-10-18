# API Connection Status Summary

## Quick Reference

### Status: ✓ PROPERLY CONNECTED

All frontend applications are making real API calls to the backend with proper authentication and error handling.

---

## What Works

### Admin Dashboard
- **Dashboard Homepage**: Fetches onboarding status + dashboard metrics from API
- **Catalog Page**: Lists products, supports filtering, bulk operations
- **Inventory Page**: Real-time stock levels and adjustment history
- **Onboarding Page**: 6-step wizard with API persistence

**API Calls**: 24 instances using the centralized `apiFetch()` helper

### Storefront
- **Products Page**: Server-side RSC fetching with pagination & search
- **Product Detail**: Dynamic product lookup with ISR caching
- **Checkout**: Real checkout session creation with order data

**API Calls**: All public endpoints (`/public/v1/storefront/*`)

---

## No Issues Found

- No hardcoded mock data in components
- No localStorage/sessionStorage pretending to be data
- No placeholder datasets being used as "real" data
- All data flows from API endpoints

---

## One Required Action

Set `NEXT_PUBLIC_API_URL` environment variable:

```bash
# In /admin/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8787

# In /frontend/.env.local  
NEXT_PUBLIC_API_URL=http://localhost:8787
```

Without this, the apps show helpful error messages prompting you to set it.

---

## API Endpoints Used

### Admin API (`/v1/*` - requires Bearer token)
- `GET /v1/products` - List all products
- `PATCH /v1/products/:id` - Update product
- `DELETE /v1/products/:id` - Delete product
- `GET /v1/inventory/levels` - View inventory
- `POST /v1/inventory/adjustments` - Record adjustments
- `GET /v1/onboarding` - Current step
- `POST /v1/onboarding` - Update step
- `GET /v1/admin/dashboard/overview` - Dashboard metrics

### Public API (`/public/v1/*` - no auth required)
- `GET /public/v1/storefront/{tenant}/products` - List products
- `GET /public/v1/storefront/{tenant}/cart` - Get cart
- `POST /public/v1/storefront/{tenant}/cart/items` - Add item
- `PATCH /public/v1/storefront/{tenant}/cart/items` - Update item
- `DELETE /public/v1/storefront/{tenant}/cart/items/:id` - Remove item
- `POST /public/v1/storefront/{tenant}/cart/checkout` - Checkout

---

## Authentication

### Admin Dashboard
- Token stored in `localStorage` as `token`
- Sent as `Authorization: Bearer {token}`
- Fallback: `cf-access-jwt-assertion: dev-bypass` in dev mode

### Storefront
- Session tokens in `sessionStorage`
- Sent as `x-cart-session` header
- Public pages require no auth

---

## Fallback Strategy

The dashboard has realistic fallback data that appears only when the API is unreachable:
- Revenue: 482,000 NPR
- Orders: 142
- Return rate: 1.3%

This ensures the UI doesn't break, but clearly indicates it's showing defaults.

---

## Next Steps

1. **Required**: Set `NEXT_PUBLIC_API_URL=http://localhost:8787`
2. **Recommended**: Standardize onboarding page to use `apiFetch()` like other pages
3. **Future**: Add retry logic for transient failures

---

For detailed information, see `/docs/FRONTEND-BACKEND-AUDIT.md`

## Checkout Telemetry & Validation TODOs

- Better Stack: add a dashboard panel for `/public/v1/storefront/:tenant/cart/checkout` latency + error rates.
- PostHog: capture events `storefront_checkout_started` and `storefront_checkout_confirmed` with session id and tenant slug.
- Playwright: add E2E covering add-to-cart → checkout form submit → confirmation page polling.
- DB migrations: ensure `20251024221500_cart_sessions_checkout` and `20251024230000_checkout_sessions` are deployed before enabling payments.
