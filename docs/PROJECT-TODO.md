# ✅ Master Execution Checklist
> Living backlog derived from all documentation. Convert each bullet into tracker tickets and track status here (✅ done, ⏳ in progress, 🔴 blocked).

---

## 1. Platform Provisioning & Access
- [x] Cloudflare account: Workers, Pages, KV, R2, Durable Objects, Access, DNS → projects created, policies applied, API token stored securely.
- [x] Neon Postgres: create production + staging branches, configure pooling, invite collaborators.
- [ ] Supporting services: MeiliSearch, PostHog, Better Stack, AWS SES, Sparrow SMS, DNSimple, PagerDuty.
- [ ] Secrets management: load all service keys into Cloudflare Secrets + GitHub Actions; document rotation policy.
- [ ] Bootstrap GitHub org permissions, branch protection, required reviews, Codecov integration.

## 2. Database & Multi-Tenancy (ref `docs/database/*`)
- [ ] Apply Prisma schema migration baseline; ensure all tables/indexes from `DATA-MODELS.md`.
- [ ] Implement Neon RLS policies, roles, connection settings per `NEON-MULTI-TENANT.md`.
- [ ] Seed default data: subscription plans, permissions matrix, provinces/districts, test tenant.
- [ ] Build tenant provisioning transaction + background seeding job.
- [ ] Set up monitoring queries + nightly branch snapshots.

## 3. Backend API Delivery (ref `docs/architecture/API-SPECIFICATIONS.md`)
- [ ] Auth & session lifecycle endpoints + KV session store, audit events, rate limits.
- [ ] Tenant & staff management endpoints with invite flow, plan limit enforcement.
- [ ] Catalog & inventory APIs, R2 media uploads, MeiliSearch reindex queue.
- [ ] Pricing/discount logic with advisory locks, usage tracking.
- [ ] Cart/checkout/order pipeline (Durable Objects cart, payments gateway factory, order events).
- [ ] Fulfillment + logistics integrations (Pathao, Tootle, Nepal Post) with BYOK support.
- [ ] Payment normalization, reconciliation endpoint, payout reporting.
- [ ] Storefront public APIs with edge caching, bilingual fallback, anonymous checkout toggle.
- [ ] Super admin endpoints with impersonation + metrics view.
- [ ] Webhook subscription + retry worker, HMAC signatures, replay.
- [ ] Observability: OpenTelemetry instrumentation, Better Stack logging, PagerDuty alerts.
- [ ] Generate OpenAPI 3.1 spec, publish to repo, wire CI contract tests.

## 4. Frontend & UX
- [ ] Merchant onboarding wizard (6 steps) with API integrations, progress tracking.
- [ ] Merchant dashboard foundation: navigation, RBAC-aware UI, analytics placeholders.
- [ ] Store builder: theme marketplace, drag/drop builder, localization support.
- [ ] Checkout + storefront UI with Nepali/English toggle, responsive design.
- [ ] Super admin dashboard protected by Cloudflare Access.
- [ ] Social commerce connectors UI (Facebook, Instagram, WhatsApp, TikTok, Viber).
- [ ] Marketing tools UI (emails, SMS, campaigns, discounts, loyalty).

## 5. Integrations & Infrastructure
- [x] Execute Cloudflare services setup playbook (`docs/integrations/CLOUDFLARE-SERVICES.md`).
- [ ] Implement Nepal payment/logistics/SMS integrations (`docs/integrations/NEPAL-SERVICES.md`).
- [x] Configure SES domains + templates; Sparrow SMS sender IDs (SES verified & credentials stored).
- [x] Domain management via Cloudflare DNS: Pages projects, wildcard storefront subdomains, SSL automation.
- [x] Provision AWS SQS queues (jobs, webhooks) + DLQs; create IAM user with scoped policy; store credentials in secrets.
- [x] Stand up PostHog analytics (keys configured, env files seeded, instrumentation ready).
- [x] Configure Better Stack logging & uptime alerts (log helper added, monitors created).

## 6. DevOps & CI/CD (ref `docs/deployment/DEPLOYMENT-CICD.md`)
- [ ] Implement GitHub Actions workflows (ci.yml, deploy-web.yml, deploy-api.yml, db-migrate.yml, release.yml).
- [ ] Define environment branches (dev/staging/main) with deployment approvals.
- [ ] Add pnpm scripts (`deploy:*`, `rollback:*`, `test:*`) and Turbo setup.
- [ ] Configure staging/production Pages + Workers projects with environment variables.
- [ ] Update queues-related scripts/services to use AWS SQS (enqueue/dequeue helpers, IAM credentials).
- [ ] Set up monitoring dashboards, alerts, and rollback procedures.

## 7. Quality Engineering (ref `docs/guides/TESTING-STRATEGY.md`)
- [ ] Configure Vitest across packages with MSW mocks and coverage thresholds.
- [ ] Build integration test harness with Neon shadow DB + fixtures.
- [ ] Author Playwright suites (desktop/mobile) with data reset hooks + artifact retention.
- [ ] Establish contract-testing pipeline and JSON schema validation.
- [ ] Implement k6 load tests + Lighthouse automation.
- [ ] Add security scans (Snyk, OWASP ZAP) to CI nightly.
- [ ] Document tests/README, flake quarantine policy, QA runbooks.

## 8. Security & Compliance (ref `docs/guides/SECURITY-CHECKLIST.md`)
- [ ] Adopt Argon2id hashing (validate Workers compatibility) + enforce reset policies.
- [ ] Implement tenant isolation integration test + rate limiting middleware.
- [ ] Sanitize content, enforce CSP, secure cookies, log admin actions.
- [ ] Encrypt sensitive columns (payments, KYC) using envelope encryption.
- [ ] Enforce WAF/Zero Trust, rotate secrets, audit dependencies.
- [ ] PCI DSS SAQ-A posture: tokenized payments, webhook signature validation, dispute log.
- [ ] Incident response runbook, PagerDuty/SMS escalation, quarterly chaos exercise.
- [ ] Privacy compliance: consent logging, DSAR anonymization flow, bilingual policies.

## 9. Program Management
- [ ] Break each checkbox into tracker tickets with owners/dates.
- [ ] Align with sprint roadmap (24 sprints) and update burndown weekly.
- [ ] Establish weekly architecture/security/testing reviews.
- [ ] Track KPIs (merchants, ARR, churn) in ops dashboard once metrics available.
- [ ] Schedule post-launch support (+24h watch) and customer success onboarding.

## 10. Catalog & Storefront (Sprints 3–4)
- [ ] Extend catalog schema (variants, collections, tags) and update migrations.
- [ ] Implement product media storage via R2 + image ordering.
- [ ] Build merchant catalog UI (list + detail editor) with PostHog instrumentation.
- [ ] Expose storefront product APIs and initial customer-facing pages.
- [ ] Wire inventory adjustments, low-stock alerts, and usage counters.
- [ ] Implement multi-step onboarding wizard and checklist.
- [ ] Expand automated tests (Vitest/Playwright) for catalog & storefront flows.

---

**Usage:** Update status inline, link to tickets, and version-control this document as work progresses.
