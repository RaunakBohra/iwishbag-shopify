# 🧪 Testing Strategy

> **Version:** 1.0
> **Status:** In Progress

A living plan for ensuring the platform ships with confidence. Each section contains issue-ready tasks.

---

## 0. Quality Gates

- [ ] CI must block merges unless unit, integration, lint, and type-check jobs pass.
- [ ] Require Playwright smoke run on `staging` branch before production promotion.
- [ ] Track coverage in Codecov; enforce 80% line coverage for core packages.
- [ ] Snapshot coverage trends weekly in Retro doc.

---

## 1. Unit Tests (Vitest)

**Scope:** Pure functions, React components, hooks, utilities, Prisma mappers.

**Checklist**
- [ ] Create `vitest.config.ts` per package (`frontend`, `api`, `shared`).
- [ ] Mock external services with MSW for fetch, `undici` for Workers.
- [ ] Enforce `describe`/`it` naming conventions (Given/When/Then).
- [ ] Add golden snapshot tests for UI components with stable DOM.
- [ ] Measure performance-sensitive utilities (currency formatter) with `vi.spyOn(console, 'warn')` to ensure no warnings.

---

## 2. Integration Tests

**Scope:** API routes + database, queues, and third-party integrations (mocked).

**Checklist**
- [ ] Spin up Neon shadow database per run (use `process.env.DATABASE_URL_SHADOW`).
- [ ] Seed baseline fixtures (tenant, user, product) via Prisma seeder.
- [ ] Cover critical flows: merchant signup, product CRUD, checkout, payment verification, fulfillment.
- [ ] Mock external webhooks (eSewa, Pathao) using MSW server.
- [ ] Validate RLS by attempting cross-tenant access.
- [ ] Generate OpenAPI contract tests to ensure responses match schema.

---

## 3. End-to-End (Playwright)

**Scope:** Full user journeys across web + merchant dashboards.

**Checklist**
- [ ] Configure separate projects for desktop + mobile viewport.
- [ ] Use environment-specific data reset hook before suite (trigger API endpoint to reseed).
- [ ] Automate flows: onboarding wizard, add product, checkout, fulfill order, refund order.
- [ ] Capture video + traces for flake analysis; retain last 20 runs in storage.
- [ ] Integrate with GitHub Actions artifacts; link failures to Slack alert.

---

## 4. Contract & Schema Testing

- [ ] Run `pnpm test:contracts` to diff OpenAPI schema vs implementation.
- [ ] Add GraphQL contract tests once GraphQL gateway lands.
- [ ] Validate webhook payloads against JSON Schema before dispatching.

---

## 5. Performance & Load

- [ ] Implement k6 smoke (100 VU, 5 min) against staging weekly.
- [ ] Stress test checkout at 500 VU pre-launch; ensure p95 < 500ms.
- [ ] Record SPA Lighthouse scores (mobile + desktop) >90.

---

## 6. Security Testing

- [ ] Run Snyk / npm audit weekly in CI.
- [ ] Add OWASP ZAP baseline scan to nightly pipeline.
- [ ] Perform manual pentest checklist per release candidate (see `SECURITY-CHECKLIST.md`).

---

## 7. Observability & Test Data

- [ ] Centralize test logs in Better Stack (tag `env=test`).
- [ ] Mask PII in fixtures (use generated Nepali names).
- [ ] Provide helper to create tenants with deterministic IDs for tests.
- [ ] Auto-expire test tenants older than 7 days via cron.

---

## 8. Release Readiness

- [ ] Maintain `tests/README.md` with commands + troubleshooting tips.
- [ ] Document known flakes; quarantine with owner + fix-by date.
- [ ] Produce QA runbooks for manual exploratory testing pre-launch.

