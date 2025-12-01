# 🧭 Execution Plan – Nepal E-Commerce Platform

> Status: Drafted by Codex (GPT-5) • Date: 2025-01-16  
> Scope: Phase 2 wrap-up through Phase 6 launch, aligned with `docs/00-MASTER-PLAN.md`

---

## 🗂️ Plan Structure

| Phase | Sprint Window | Focus | Key Outcomes |
|-------|---------------|-------|--------------|
| Phase 2 | Weeks 1-2 | Architecture & design hardening | Prisma schema finalized, RLS + shared types + API specs |
| Phase 3 | Weeks 2-10 | Core platform | Auth/base admin, onboarding, catalog builder, checkout/payments |
| Phase 4 | Weeks 10-16 | Orders & logistics | Fulfillment workflows, logistics integrations, worker automation |
| Phase 5 | Weeks 16-20 | Marketing & comms | Email/SMS infra, automation, analytics |
| Phase 6 | Weeks 20-24 | Nepal-specific & social | Localization, provincial shipping, social commerce sync |

Each sprint includes success criteria, dependencies, and test/observability expectations.

---

## 📐 Phase 2 – Architecture & Design Completion (Weeks 1-2)

### Sprint 2.4 – Schema, RLS, Shared Contracts
- **Prisma schema hardening**
  - Add missing models (staff, audit helpers) and required enums.
  - Enforce plan limits via triggers or Prisma middleware.
  - Validate JSON columns with lightweight schemas.
- **Row-Level Security**
  - Apply `app/tenant_isolation.sql` to new tables; add verification tests.
  - Document `app.set_tenant` usage in API bootstrap.
- **Shared contracts**
  - Populate `shared/` workspace with DTOs for auth, products, cart, onboarding.
  - Align tsconfig references and ensure admin/frontend/workers consume shared types.
- **API specs + tests**
  - For every mounted route in `api/src/index.ts`, draft OpenAPI snippets + Vitest integration stubs (similar to storefront cart test).
  - Define request/response schemas for onboarding, checkout, discounts, inventory.
- **Infra documentation**
  - Capture Cloudflare KV/R2 bindings, Neon branching, Better Stack log setup in `/docs/infra/ENVIRONMENT.md`.

**Exit Criteria**
1. `pnpm test --workspace api` validates schema + new tests.
2. Shared package published locally (tsc passes for admin/frontend).
3. Docs updated (schema + infra).

---

## 🧱 Phase 3 – Core Platform Development

### Sprint 3.1 (Weeks 2-4) – Foundation
- Implement tenant auth service (email/password, session tokens) in API + admin NextAuth adapter.
- Build RBAC middleware enforcing `UserRole`.
- Deliver admin dashboard shell (layout, nav, tenant switcher, session context).
- CRUD for tenants/users with plan quota enforcement + RLS verification.
- **Testing**: Vitest unit tests for auth services; Playwright smoke for admin login.

### Sprint 3.2 (Weeks 4-6) – Merchant Onboarding
- Registration + KYC workflow (forms, file uploads to R2, approval states).
- Store setup wizard: branding, theme pick, domain connection, SSL automation via Cloudflare API.
- Domain verification management UI + worker for DNS polling.
- **Testing**: Playwright coverage for onboarding flow; mocked KYC worker tests.

### Sprint 3.3 (Weeks 6-8) – Store Builder
- Product catalog CRUD (products, variants, collections, tags, media uploads).
- Inventory tracking + adjustment history + reservations.
- Theme marketplace + drag-and-drop page builder leveraging `pages/page_blocks`.
- **Testing**: API contract tests for catalog endpoints; component tests for builder UI.

### Sprint 3.4 (Weeks 8-10) – Checkout & Payments
- Cart service completion (KV sessions, pricing engine, discount stacking).
- Storefront checkout UI (multi-step, bilingual, responsive).
- Payment gateway integrations (eSewa, Khalti, IME Pay, ConnectIPS, FonePay, COD) with webhook handling + order creation.
- VAT invoice generation via pdf-lib.
- **Testing**: Integration tests per gateway (mocked), storefront Playwright checkout, invoice snapshot tests.

---

## 📦 Phase 4 – Order Management & Fulfillment (Weeks 10-16)

### Sprint 4.1 – Order System
- Admin order dashboard with status transitions, fraud checks, notes.
- Fulfillment workflow (pick lists, packing slips, label generation).
- Inventory reservations release/capture automation.

### Sprint 4.2 – Logistics Integration
- APIs for Pathao, Tootle, Nepal Post rate calculator, manual courier.
- Delivery tracking, proof-of-delivery uploads to R2.
- Worker queues for shipment status polling + notifications.

**Testing/Observability**
- Contract tests for each logistics integration (mocked).
- Worker unit tests + queue simulations.
- Better Stack dashboards for fulfillment latency.

---

## 📣 Phase 5 – Marketing & Communications (Weeks 16-20)

- AWS SES setup, template builder, transactional + marketing campaigns, analytics dashboards.
- Sparrow SMS integration: OTP, order updates, marketing blasts with bilingual templates.
- Abandoned cart + delivery notification automations (queues + workers).
- Compliance logging for messaging opt-ins.

**Testing**
- Mocked SES/Sparrow integration tests; Playwright validation for template UI.
- Load testing for campaign sends.

---

## 🌐 Phase 6 – Nepal-Specific & Social Commerce (Weeks 20-24)

- Localization: full Nepali translations, Nepali number formatting, Bikram Sambat calendar, province-wise shipping calculator, Dashain/Tihar templates.
- Social commerce automation: Facebook/Instagram shop sync, WhatsApp/Viber CTAs, Messenger bot, TikTok integration.
- Reporting updates for bilingual analytics.

**Testing**
- Snapshot tests for localization assets.
- Scheduled jobs for social sync with retry policies.

---

## 🔄 Cross-Cutting Workstreams

- **Testing**: Expand Vitest coverage, storefront/admin Playwright suites, load tests for checkout and messaging.
- **Observability**: Better Stack log/metrics per worker, Sentry on admin/frontend, PostHog analytics instrumentation.
- **CI/CD**: pnpm monorepo pipeline, preview deployments, schema drift checks, automated migrations (Neon).
- **Security & Compliance**: Pen-test checklist, secrets management, audit logging, GDPR-ready data deletion.

---

## ✅ Next Actions
1. Execute Phase 2 sprint backlog (schema/RLS/shared contracts/tests/docs).
2. Stand up auth foundation (Phase 3 Sprint 1) immediately after schema hardening.
3. Review plan bi-weekly against actual velocity; adjust sprint scope as needed.

This document serves as the living backlog—update at sprint reviews to reflect progress and reprioritization.
