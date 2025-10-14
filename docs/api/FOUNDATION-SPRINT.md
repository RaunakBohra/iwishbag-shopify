# 🧱 Foundation Sprint Plan (Sprints 1–2)

> Implementation checklist now that the API worker scaffold (`api/src/index.ts`) is live.

---

## 1. Authentication & Sessions
- [x] Implement `/v1/auth/register`, `/login`, `/logout`, `/refresh`, `/me`.
- [x] Rate limiting, password hashing, JWT issuance, KV refresh tokens, tenant slug + default roles seeded.
- [ ] Hash passwords with Argon2id (fallback to bcrypt if Worker limits apply).
- [ ] Store sessions in Cloudflare KV (`SESSIONS` binding) with TTL + audit events.
- [ ] Add rate limiting middleware using `RATE_LIMIT` KV namespace (5 attempts / 15 minutes).
- [ ] Issue JWTs (jose) with tenant + role claims; log auth events via `logToBetterStack`.

## 2. Tenant & User Management
- [ ] Create `/v1/tenants` and `/v1/staff` routes with invite flow (signed token + KV storage).
- [ ] Seed `owner`, `staff`, `platform_admin` roles using Prisma migrations.
- [ ] Expose `/v1/tenants/current/stats` for plan usage (products/orders/staff counts).
- [ ] Enforce plan limits (respond 429 when exceeded).

## 3. Admin Shell
- [ ] Stand up placeholder `apps/admin` page protected by Cloudflare Access.
- [ ] Add `/v1/admin/health` and `/v1/admin/tenants` stubs returning mock data.
- [ ] Verify Cloudflare Access JWT is required for admin endpoints.

## 4. Observability & Testing
- [ ] Extend `logToBetterStack` usage for errors/exceptions.
- [ ] Add PostHog events (`merchant_registered`, `login_success`) for dev testing.
- [ ] Write Vitest unit tests for auth service + integration tests for `/auth` routes.

---

*Next milestone:* complete above, then move to catalog + onboarding flows (Sprints 3–4).
