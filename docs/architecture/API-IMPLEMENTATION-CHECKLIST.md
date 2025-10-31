# 🧱 Backend API Implementation Checklist

> Derived from `docs/architecture/API-SPECIFICATIONS.md`. Use this to turn each outstanding API surface into actionable work items.

## 1. Authentication & Sessions
- [x] Finalize Zod schemas for register/login/logout/refresh/forgot/reset/2FA endpoints.
- [x] Implement password policy helper with tests (min length, complexity).
- [x] Persist refresh sessions in Cloudflare KV with 7-day TTL + revoke on logout.
- [x] Emit audit events (`auth.registered`, `auth.login`, `auth.logout`) via Better Stack/PostHog.
- [x] Add rate limiting middleware (5 attempts / 15 min) for login + password reset routes.
- [x] Return `X-Auth-Token-Ttl` header on refresh + `me` responses.

## 2. Tenant & Staff Management
- [x] Implement invite token flow using signed KV-backed tokens (15 min TTL).
- [ ] Enforce RBAC permissions (`staff.manage`, `tenant.update`) in middleware.
- [ ] Return plan usage stats from `/v1/tenants/current/stats`.
- [ ] Ensure plan limits trigger 429 when staff/products exceed allowance.
- [ ] Cover flows with integration tests (invite lifecycle + plan limit enforcement).

## 3. Pricing & Discounts
- [ ] Model tiered discounts (amount/percentage/buy-X-get-Y) with validation helpers.
- [ ] Persist discount usage in `discount_usages` with advisory locks to enforce limits.
- [ ] Expose discount eligibility endpoint for storefront/cart usage.
- [ ] Add unit tests covering overlapping discount rules + concurrency.

## 4. Cart, Checkout & Orders
- [x] Stand up API-backed cart service (sessions, line mutations, totals snapshots).
- [ ] Integrate tax/shipping calculators and persist quotes in cart state.
- [x] Implement checkout session endpoints (create/preview/confirm/submit) with inventory reservations.
- [ ] Implement order creation endpoint writing order timeline events.
- [ ] Wire payment gateway factory (see `docs/integrations/PAYMENTS.md`) and capture/refund flows.
- [ ] Publish webhooks (`order.created`, `order.payment_failed`, `order.fulfilled`) and add retries.

## 5. Fulfillment & Logistics
- [ ] Build provider activation endpoints (Pathao, Tootle, Nepal Post) with BYOK credentials.
- [ ] Implement order fulfillment + tracking update flows.
- [ ] Ingest carrier webhooks and map to internal shipment events.
- [ ] Add SLA monitoring (Better Stack heartbeat) for fulfillment worker.

## 6. Payments & Reconciliation
- [ ] Normalize payment provider payloads into `payments`, `payment_attempts`, `refunds`.
- [ ] Expose reconciliation endpoint for finance (export/CSV).
- [ ] Schedule payout summary job + webhook for completed payouts.
- [ ] Add fraud/chargeback event handling stubs.

## 7. Storefront Public APIs
- [ ] Add edge caching (Cloudflare) + bilingual fallback logic to `/v1/storefront/:tenantSlug/products`.
- [ ] Implement storefront product detail + availability endpoints.
- [ ] Add anonymous checkout toggle and enforce on cart/order routes.
- [ ] Ensure API honours tenant storefront visibility settings.

## 8. Super Admin Surface
- [ ] Build super admin metrics endpoints (`/v1/admin/metrics`, `/v1/admin/tenants` real data).
- [ ] Add impersonation endpoint allowing support staff to assume tenant context (with audit log).
- [ ] Secure endpoints behind Cloudflare Access JWT middleware.

## 9. Webhooks & Observability
- [ ] Implement webhook subscription CRUD with HMAC signature validation.
- [ ] Create webhook retry worker with exponential backoff + DLQ logging.
- [ ] Add OpenTelemetry spans across API routes and export to Better Stack.
- [ ] Generate OpenAPI 3.1 document, publish artifact, and wire CI contract tests.

## 10. Testing & QA
- [ ] Expand Vitest coverage for auth/tenant/pricing/order flows.
- [ ] Add integration test harness (Neon shadow DB) covering tenant isolation + transactions.
- [ ] Author contract tests for public/storefront APIs.
- [ ] Document API QE runbook (test data, fixtures, rollback).
