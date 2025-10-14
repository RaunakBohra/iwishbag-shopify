# 🧱 Foundation Sprint Plan (Sprints 1–2)

> Implementation checklist now that the API worker scaffold (`api/src/index.ts`) is live.

---

## 1. Authentication & Sessions
- [x] Implement `/v1/auth/register`, `/login`, `/logout`, `/refresh`, `/me`.
- [x] Rate limiting, password hashing, JWT issuance, KV refresh tokens, tenant slug + default roles seeded.

## 2. Tenant & User Management
- [x] `/v1/tenants/current` + PATCH update + stats endpoint.
- [x] Staff CRUD (`GET/POST/PATCH/DELETE /v1/staff`) with plan limit enforcement and soft delete.
- [x] Default roles seeded per tenant and attached to staff.
- [x] Tenant invites (`create`, `list`, `resend`, `revoke`, `accept`), usage updates, and invite tests.

## 3. Admin Shell
- [x] Stand up placeholder `apps/admin` page protected by Cloudflare Access.
- [x] Add `/v1/admin/health` and `/v1/admin/tenants` stubs returning mock data.
- [x] Verify Cloudflare Access JWT is required for admin endpoints.

## 4. Observability & Testing
- [x] Extend `logToBetterStack` usage for errors/exceptions.
- [x] Add PostHog events (TODO when analytics wiring begins).
- [x] Unit tests for auth utilities, roles middleware, invites (`npm run --workspace iwishbag-store-api test`).

## 5. Catalog & Inventory (Sprint 3)
- [x] Product schema, migrations, and Prisma client refresh.
- [x] Product CRUD endpoints (`/v1/products`) with plan limit enforcement.
- [x] Catalog service unit tests.
- [ ] Variant/asset management & marketplace integrations (future).

---

*Next milestone:* complete above, then move to catalog + onboarding flows (Sprints 3–4).
