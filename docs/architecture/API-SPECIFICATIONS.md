# 📜 API SPECIFICATIONS

> **Version:** 1.0
> **Status:** In Progress

This document defines the REST surface for the Nepal E-Commerce Platform and breaks implementation into atomic tasks. Treat each checkbox as an issue-ready unit of work.

---

## 0. Implementation Overview

- Base URL: `https://api.nepshop.com`
- Auth: JWT (bearer) with tenant-scoped claims; all merchant endpoints require both `tenantId` and `role` claims.
- Request/response bodies use JSON; encode IDs as UUID strings.
- Every endpoint returns the canonical envelope:
  - Success: `{ "data": <payload>, "meta": { ... } }`
  - Error: `{ "error": { "code": "...", "message": "...", "details": [...] } }`
- Versioning strategy: prefix with `/v1`; introduce `/v2` when breaking changes are unavoidable.
- Pagination: cursor based (`nextCursor`, `prevCursor`);
- Rate limits: 120 requests/min per tenant for dashboard, 300/min for storefront public APIs.

---

## 1. Authentication & Session Lifecycle

### Endpoints
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `POST /v1/auth/refresh`
- `POST /v1/auth/password/forgot`
- `POST /v1/auth/password/reset`
- `POST /v1/auth/2fa/setup`
- `POST /v1/auth/2fa/verify`
- `GET /v1/auth/me`

### Implementation Tasks
- [ ] Validate payloads with Zod schemas per endpoint.
- [ ] Create shared password policy validator (min length, complexity).
- [ ] Persist sessions in Cloudflare KV with 7-day TTL.
- [ ] Emit structured audit events on register/login/logout.
- [ ] Integrate rate limit (5 attempts/15 min) on login + password reset.
- [ ] Expose `X-Auth-Token-Ttl` header on refresh and `me` endpoints.

---

## 2. Tenant & User Management

### Endpoints
- `POST /v1/tenants`
- `GET /v1/tenants/current`
- `PATCH /v1/tenants/current`
- `GET /v1/tenants/current/stats`
- `POST /v1/tenants/current/invite`
- `POST /v1/tenants/current/invite/accept`
- `GET /v1/staff`
- `POST /v1/staff`
- `PATCH /v1/staff/:staffId`
- `DELETE /v1/staff/:staffId`

### Implementation Tasks
- [ ] Enforce RLS via `tenant_id`; double-check runtime guard in middleware.
- [ ] Implement invite token flow using signed short-lived tokens (15 min) stored in KV.
- [ ] Ensure staff endpoints honour RBAC permissions (`staff.manage`).
- [ ] Return plan usage stats (products/orders/staff counts) in `/stats`.
- [ ] Wire plan limits to 429 errors when thresholds exceeded.

---

## 3. Product Catalog

### Endpoints
- `GET /v1/products`
- `POST /v1/products`
- `GET /v1/products/:productId`
- `PATCH /v1/products/:productId`
- `DELETE /v1/products/:productId`
- `POST /v1/products/:productId/images`
- `DELETE /v1/products/:productId/images/:imageId`
- `POST /v1/products/bulk`
- `POST /v1/products/:productId/archive`
- `POST /v1/collections`
- `PATCH /v1/collections/:collectionId`
- `GET /v1/collections`
- `GET /public/v1/storefront/:tenantSlug/products`

### Implementation Tasks
- [ ] Enforce optimistic concurrency via `updated_at` check on updates.
- [ ] Upload product media to R2; return signed URLs.
- [x] Trigger MeiliSearch re-index via Cloudflare Queue on create/update/delete.
- [ ] Add background job to recalc inventory counts nightly.
- [ ] Validate variant SKUs unique per product.

---

## 4. Inventory & Warehousing

### Endpoints
- `GET /v1/inventory/levels`
- `PATCH /v1/inventory/levels`
- `POST /v1/inventory/adjustments`
- `GET /v1/inventory/adjustments`
- `POST /v1/inventory/transfers`
- `POST /v1/inventory/alerts/test`

### Contracts
- **`POST /v1/inventory/adjustments`**
  - Purpose: Apply additive inventory delta for a product/variant pair.
  - Request schema:
    ```jsonc
    {
      "productId": "prod_123",
      "variantId": "var_987",        // optional; when omitted adjust base product stock
      "quantity": -2,                 // positive = restock, negative = decrement
      "reason": "ORDER_FULFILLED",   // enum: MANUAL, SHIPMENT_RECEIVED, ORDER_FULFILLED, DAMAGE, OTHER
      "memo": "Order #1001"
    }
    ```
  - Behaviour:
    - Runs in a transaction that locks target variant/product row (`FOR UPDATE`).
    - Rejects adjustments pushing inventory below zero unless tenant flag `allowBackorders` is true.
    - Persists row in `inventory_adjustments` with actor + metadata and updates `TenantUsage` counters where applicable.
    - Emits `inventory.updated` webhook and enqueues catalog event for storefront cache purge.
  - Response: `{ "data": { "inventory": { "available": 18, "reserved": 0 }, "adjustment": { ... } } }`

- **`GET /v1/inventory/levels`**
  - Returns paginated inventory snapshot by product/variant.
  - Accepts filters `productId`, `sku`, `status`, `inStock`.
  - Includes `available`, `reserved`, `incoming`, `updatedAt` fields.
  - Backed by materialized `product_inventory` table kept in sync by catalog worker.

- **`GET /v1/inventory/adjustments`**
  - Paginates historical adjustments; supports filters by `productId`, `variantId`, `reason`, `createdBy`.

- **`POST /v1/inventory/alerts/test`**
  - Allows merchants to trigger a sample low-stock alert webhook/email to validate configuration.

### Alerting Strategy
- Low-stock threshold stored per product (`lowStockThreshold` default 5). Worker recomputes nightly and on adjustments; when available inventory ≤ threshold and previously above threshold, enqueue alert notification and mark timestamp.
- Notifications delivered via: email (Postmark), dashboard notification, optional webhook (`inventory.low_stock`).
- Deduplicate by product/variant per 24h window.

### Background Jobs
- **Inventory Snapshot Refresh:** catalog worker already recomputes on change; nightly cron (Workers Scheduled event) re-syncs to guard against drift.
- **Alert Sweep:** scheduled Worker runs every 15 minutes. For each tenant/product where `available <= lowStockThreshold` and `lastAlertAt > 24h`, enqueue `inventory-alerts` message, send email/webhook, and update `lastAlertAt`.

### Implementation Tasks
- [ ] Implement transactional adjustment writer (wrap in Neon transaction).
- [ ] Emit webhook `inventory.updated` after adjustment.
- [ ] Prevent negative stock unless `allowBackorders` flag set.
- [ ] Add cron job for low-stock notifications (configurable threshold).

---

## 5. Pricing & Discounts

### Endpoints
- `GET /v1/discounts`
- `POST /v1/discounts`
- `PATCH /v1/discounts/:discountId`
- `DELETE /v1/discounts/:discountId`
- `POST /v1/discounts/:discountId/usage`

### Implementation Tasks
- [ ] Support tiered discounts (amount, percentage, buy X get Y) with schema validation.
- [ ] Record usage analytics per discount to `discount_usages` table.
- [ ] Enforce usage limits atomically with advisory locks.

---

## 6. Checkout & Orders

### Endpoints
- `POST /v1/cart`
- `PATCH /v1/cart`
- `POST /v1/cart/checkout`
- `POST /v1/orders`
- `GET /v1/orders`
- `GET /v1/orders/:orderId`
- `PATCH /v1/orders/:orderId`
- `POST /v1/orders/:orderId/capture`
- `POST /v1/orders/:orderId/cancel`
- `POST /v1/orders/:orderId/refund`

### Implementation Tasks
- [ ] Cart service to run on Durable Object keyed by session/tenant.
- [ ] Validate shipping/tax via configurable calculators.
- [ ] Persist timeline events to `order_events` table for audit.
- [ ] Integrate payment providers through gateway factory (see Integrations doc).
- [ ] Publish `order.created` and `order.payment_failed` webhooks.

---

## 7. Fulfillment & Shipping

### Endpoints
- `GET /v1/shipping/providers`
- `POST /v1/shipping/providers/:providerId/activate`
- `POST /v1/orders/:orderId/fulfill`
- `POST /v1/orders/:orderId/track`
- `POST /v1/fulfillments/:fulfillmentId/proof`

### Implementation Tasks
- [ ] Support both platform-managed and BYOK credentials.
- [ ] Store tracking numbers + status history in `fulfillments` table.
- [ ] Upload proof-of-delivery images to R2; link in fulfillment record.
- [ ] Poll external providers (Pathao/Tootle) every 30 minutes for status sync.

---

## 8. Payments & Billing

### Endpoints
- `POST /v1/payments/initiate`
- `POST /v1/payments/verify`
- `GET /v1/payments/:paymentId`
- `POST /v1/payments/:paymentId/refund`
- `GET /v1/payouts`

### Implementation Tasks
- [ ] Normalize all payment provider payloads into internal `payments` schema.
- [ ] Store raw gateway response for audit (encrypted column).
- [ ] Support manual reconciliation endpoint for admins (`PUT /v1/payments/:id/reconcile`).
- [ ] Fire `payment.settled` webhook to tenant on success.

---

## 9. Storefront Public APIs

### Endpoints
- `GET /v1/storefront/:tenantSlug/products`
- `GET /v1/storefront/:tenantSlug/products/:productId`
- `POST /v1/storefront/:tenantSlug/cart`
- `POST /v1/storefront/:tenantSlug/orders`
- `GET /v1/storefront/:tenantSlug/pages`

### Implementation Tasks
- [ ] Enforce tenant-level rate limiting (per slug) separate from dashboard.
- [ ] Cache GET responses at edge (Cloudflare Cache) with 5 min TTL.
- [ ] Include Nepali + English content fallback logic.
- [ ] Support anonymous checkout toggle (tenants decide via setting).

---

## 10. Super Admin APIs

### Endpoints
- `GET /v1/admin/tenants`
- `GET /v1/admin/tenants/:tenantId`
- `POST /v1/admin/tenants/:tenantId/suspend`
- `POST /v1/admin/tenants/:tenantId/unsuspend`
- `GET /v1/admin/metrics`
- `GET /v1/admin/logs`

### Implementation Tasks
- [ ] Restrict via `platform_admin` role + Cloudflare Access JWT.
- [ ] Aggregate MRR, churn, signups in Materialized View refreshed hourly.
- [ ] Implement tenant impersonation flow with signed claim + expiry 5 min.
- [ ] PII masking when viewed by support (respect `gdpr_masked_fields`).

---

## 11. Webhooks

### Event Topics
- `order.created`
- `order.fulfilled`
- `order.refunded`
- `inventory.updated`
- `customer.created`
- `payment.settled`

### Implementation Tasks
- [ ] Webhook subscription endpoint (`POST /v1/webhooks/subscriptions`).
- [ ] Retry with exponential backoff (max 6 attempts) via Workers Queue.
- [ ] Sign payloads with HMAC SHA-256 using tenant secret.
- [ ] Provide replay endpoint for admins (`POST /v1/webhooks/:id/replay`).

---

## 12. Error Handling & Observability

### Implementation Tasks
- [ ] Map common errors to RFC 7807 structures.
- [ ] Instrument all endpoints with OpenTelemetry spans + Better Stack logging.
- [ ] Surface correlation ID (`x-request-id`) in every response.
- [ ] Send alert to PagerDuty when error rate >1% for 5 minutes.

---

## 13. Delivery Checklist

- [ ] Endpoint contracts documented in OpenAPI 3.1 (generate from source).
- [ ] Integration tests for each module run in CI (`pnpm test:api`).
- [ ] Smoke suite executed post-deploy using Playwright synthetic monitor.
- [ ] Update `docs/features/*` guides with actual endpoint paths.
- [ ] Notify support + success teams once new endpoints reach production.
- **Storefront Product Feed:** Provide unauthenticated product listing for customers via tenant slug, backed by MeiliSearch and inventory snapshots.
- **Caching:** Cloudflare edge cache with `stale-while-revalidate=30s` and per-tenant cache keys to balance freshness and cost.
- **/public/v1/storefront/:tenantSlug/products**
  - **Purpose:** Customer-facing listing endpoint for storefront apps.
  - **Query Params:**
    - `q` (string): search term (typed, optional).
    - `page` (number, default `1`), `pageSize` (number, default `24`, max `60`).
    - `collection` (string): collection slug.
    - `tags` (string[]): repeatable tag slugs.
    - `priceMin`/`priceMax` (number): price filters in primary currency.
    - `inStock` (boolean): restrict to available inventory.
    - `sort` (enum): `relevance` (default), `price_asc`, `price_desc`, `newest`.
  - **Response Shape:**
```jsonc
{
  "data": [
    {
      "id": "prod_123",
      "slug": "sunny-shirt",
      "title": "Sunny Shirt",
      "description": "Lightweight cotton",
      "status": "ACTIVE",
      "price": 1999,
      "compareAtPrice": 2299,
      "images": [
        { "url": "https://cdn.example.com/...", "alt": "Front view" }
      ],
      "variants": [
        { "id": "var_1", "name": "Small", "price": 1999, "inventory": 8 }
      ],
      "collections": ["spring-drop"],
      "tags": ["cotton", "summer"],
      "available": true,
      "inventory": {
        "available": 14,
        "reserved": 2
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 24,
    "total": 128,
    "hasNextPage": true,
    "facets": {
      "collections": [{ "value": "spring-drop", "count": 42 }],
      "tags": [{ "value": "cotton", "count": 58 }],
      "priceRanges": [
        { "min": 0, "max": 1500, "count": 25 },
        { "min": 1501, "max": 3000, "count": 60 }
      ]
    }
  }
}
```
  - **Caching:**
    - Cache key = `storefront:${tenantSlug}:${hash(query)}`.
    - `Cache-Control: public, max-age=30, stale-while-revalidate=30`.
    - Use Cloudflare Cache API in route handler; purge when catalog event worker processes updates.
  - **Rate Limits:** Shared anonymous bucket per IP + per tenant to prevent scraping.
