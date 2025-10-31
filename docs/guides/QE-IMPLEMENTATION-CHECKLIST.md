# ✅ Quality Engineering Implementation Checklist

> Map the testing strategy into actionable tasks across unit, integration, e2e, contract, performance, security, and documentation.

## 1. Vitest Configuration & Coverage
- [ ] Create per-package `vitest.config.ts` with shared base config.
- [ ] Add MSW handlers for API/service mocks; ensure tests use `setupTests.ts`.
- [ ] Enforce coverage thresholds (80% lines) in config and integrate with Codecov.
- [ ] Document testing conventions in `tests/README.md`.
- [ ] Add CI job to fail on uncovered files (using `vitest --coverage` report).

## 2. Integration Harness
- [ ] Provision Neon shadow database and connection helper.
- [ ] Build seed fixtures (tenant, user, catalog, order).
- [ ] Add utility to run migrations + teardown per test suite.
- [ ] Mock external providers (eSewa, Pathao) using MSW server.
- [ ] Validate RLS and transactional flows via dedicated integration tests.

## 3. Playwright E2E Suites
- [ ] Configure dual projects (desktop/mobile) with data reset hooks.
- [ ] Automate onboarding, product CRUD, checkout/payment, fulfillment, refund flows.
- [ ] Capture video/trace artifacts; upload via GitHub Actions.
- [ ] Add flake detection + quarantine policy (retry, owner, fix-by).
- [ ] Integrate Playwright run into `staging` gate before production deploy.

## 4. Contract & Schema Validation
- [ ] Generate OpenAPI 3.1 doc and diff responses in CI.
- [ ] Validate webhook payloads against JSON Schema.
- [ ] Add schema tests for storefront/public API responses.
- [ ] Plan for GraphQL contract tests once gateway exists.

## 5. Performance & Load
- [ ] Author k6 smoke + stress scenarios (checkout, catalog browse).
- [ ] Add Lighthouse CI for storefront/mobile.
- [ ] Record baseline metrics and set thresholds in CI.
- [ ] Schedule weekly performance run; alert on regression.

## 6. Security Scans
- [ ] Integrate Snyk (or npm audit) into CI pipeline.
- [ ] Add OWASP ZAP baseline scan nightly.
- [ ] Document manual pentest checklist and schedule per release.
- [ ] Track vulnerabilities in backlog with severity/owner.

## 7. Observability & Test Data Hygiene
- [ ] Pipe test logs to Better Stack with `env=test` tag.
- [ ] Mask PII in fixtures; prefer generated Nepali data.
- [ ] Create cleanup job to expire test tenants >7 days old.
- [ ] Provide CLI/script to generate deterministic test tenants.

## 8. Documentation & Runbooks
- [ ] Write `tests/README.md` with commands, troubleshooting, and data requirements.
- [ ] Maintain flake log with quarantine actions.
- [ ] Produce QA runbook for regression + exploratory testing.
- [ ] Update `docs/guides/TESTING-STRATEGY.md` as tasks are delivered.
