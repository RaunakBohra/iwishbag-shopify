# ✅ Master Execution Checklist
> Living backlog derived from all documentation. Convert each bullet into tracker tickets and track status here (✅ done, ⏳ in progress, 🔴 blocked).

---

## 1. Platform Provisioning & Access
- [x] Cloudflare account: Workers, Pages, KV, R2, Durable Objects, Access, DNS → projects created, policies applied, API token stored securely.
- [x] Neon Postgres: create production + staging branches, configure pooling, invite collaborators.
- [ ] Supporting services: PostHog, Better Stack, AWS SES, Sparrow SMS, DNSimple, PagerDuty. *(TODO: Capture owner/env requirements, create provisioning playbooks, track credential storage — see `docs/ops/SUPPORTING-SERVICES-CHECKLIST.md`.)*
- [ ] Secrets management: load all service keys into Cloudflare Secrets + GitHub Actions; document rotation policy. *(TODO: Draft secrets matrix, script GitHub/Workers uploads, write rotation SOP — see `docs/secrets/SECRETS-MATRIX.md`.)*
- [ ] Bootstrap GitHub org permissions, branch protection, required reviews, Codecov integration. *(TODO: Define branch rules, enable required reviews, configure Codecov app — see `docs/ops/GITHUB-GUARDRAILS.md` for policy draft.)*

## 2. Database & Multi-Tenancy (ref `docs/database/*`)
- [ ] Apply Prisma schema migration baseline; ensure all tables/indexes from `DATA-MODELS.md`. *(TODO: Generate baseline migration, verify against data model checklist, apply to Neon branches — see `docs/database/IMPLEMENTATION-CHECKLIST.md` §1.)*
- [ ] Implement Neon RLS policies, roles, connection settings per `NEON-MULTI-TENANT.md`. *(TODO: Script policy creation and add automated tests — see `docs/database/IMPLEMENTATION-CHECKLIST.md` §2.)*
- [ ] Seed default data: subscription plans, permissions matrix, provinces/districts, test tenant. *(TODO: Create seed scripts + fixtures, wire to provisioning workflow — see `docs/database/IMPLEMENTATION-CHECKLIST.md` §3.)*
- [ ] Build tenant provisioning transaction + background seeding job. *(TODO: Design worker entrypoint, add retry/backoff, cover with tests — see `docs/database/IMPLEMENTATION-CHECKLIST.md` §4.)*
- [ ] Set up monitoring queries + nightly branch snapshots. *(TODO: Schedule Neon cron job or external task, document snapshot retention — see `docs/database/IMPLEMENTATION-CHECKLIST.md` §5.)*

## 3. Backend API Delivery (ref `docs/architecture/API-SPECIFICATIONS.md`)
- [x] Auth & session lifecycle endpoints + KV session store, audit events, rate limits. *(Zod validators, password policy, audit + Better Stack/PostHog events, rate limits, TTL headers, password reset + 2FA complete — see `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §1.)*
- [x] Tenant & staff management endpoints with invite flow, plan limit enforcement. *(RBAC permissions, usage stats, plan-limit 429s, invite lifecycle tests — see `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §2.)*
- [x] Catalog & inventory APIs, R2 media uploads, catalog-events worker.
- [x] Pricing/discount logic with advisory locks, usage tracking. *(Tiered discount rules, eligibility endpoint, advisory locks, and tests landed — see `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §3.)*
- [ ] Cart/checkout/order pipeline (Durable Objects cart, payments gateway factory, order events). *(TODO: Scaffold cart Durable Object, integrate payment gateways, persist order events — see `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §4.)*
- [ ] Fulfillment + logistics integrations (Pathao, Tootle, Nepal Post) with BYOK support. *(TODO: Draft integration clients, webhook handlers, config UI hooks — see `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §5.)*
- [ ] Payment normalization, reconciliation endpoint, payout reporting. *(TODO: Define normalized payment schema, build reconciliation job + reporting API — see `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §6.)*
- [ ] Storefront public APIs with edge caching, bilingual fallback, anonymous checkout toggle. *(TODO: Extend API routes, add caching layer, toggle + locale handling — see `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §7.)*
- [ ] Super admin endpoints with impersonation + metrics view. *(TODO: Secure routes via Access, implement impersonation workflow, build metrics summaries — see `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §8.)*
- [ ] Webhook subscription + retry worker, HMAC signatures, replay. *(TODO: Create subscription CRUD, queue worker with retry/backoff, add signature validation — see `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §9.)*
- [ ] Observability: OpenTelemetry instrumentation, Better Stack logging, PagerDuty alerts. *(TODO: Instrument API, configure exporter, add alert policies — see `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §9.)*
- [ ] Generate OpenAPI 3.1 spec, publish to repo, wire CI contract tests. *(TODO: Produce schema, automate publication, add CI contract checks — see `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §9.)*

## 4. Frontend & UX
- [ ] Merchant onboarding wizard (6 steps) with API integrations, progress tracking. *(TODO: Map step flows, connect APIs, persist state, draft content — see `docs/frontend/IMPLEMENTATION-CHECKLIST.md` §1.)*
- [x] Merchant dashboard foundation: navigation, RBAC-aware UI, analytics placeholders. *(Dashboard shell live with RBAC-aware navigation, analytics placeholders, and notifications — see `docs/frontend/IMPLEMENTATION-CHECKLIST.md` §2.)*
- [ ] Store builder: theme marketplace, drag/drop builder, localization support. *(TODO: Define builder architecture, integrate theme registry, implement drag/drop — see `docs/frontend/IMPLEMENTATION-CHECKLIST.md` §4.)*
- [ ] Checkout + storefront UI with Nepali/English toggle, responsive design. *(TODO: Design responsive components, add locale switcher, hook to storefront APIs — see `docs/frontend/IMPLEMENTATION-CHECKLIST.md` §5.)*
- [ ] Super admin dashboard protected by Cloudflare Access. *(TODO: Build dashboard app, enforce Access JWT, surface metrics views — see `docs/frontend/IMPLEMENTATION-CHECKLIST.md` §6.)*
- [ ] Social commerce connectors UI (Facebook, Instagram, WhatsApp, TikTok, Viber). *(TODO: Create connector setup flows, permissions prompts, status monitoring — see `docs/frontend/IMPLEMENTATION-CHECKLIST.md` §7.)*
- [ ] Marketing tools UI (emails, SMS, campaigns, discounts, loyalty). *(TODO: Implement campaign builders, scheduling, analytics panels — see `docs/frontend/IMPLEMENTATION-CHECKLIST.md` §8.)*

## 5. Integrations & Infrastructure
- [x] Execute Cloudflare services setup playbook (`docs/integrations/CLOUDFLARE-SERVICES.md`).
- [ ] Implement Nepal payment/logistics/SMS integrations (`docs/integrations/NEPAL-SERVICES.md`). *(TODO: Prioritize providers, build integration clients, certify via sandbox tests — see `docs/integrations/IMPLEMENTATION-CHECKLIST.md`.)*
- [x] Configure SES domains + templates; Sparrow SMS sender IDs (SES verified & credentials stored).
- [x] Domain management via Cloudflare DNS: Pages projects, wildcard storefront subdomains, SSL automation.
- [x] Provision AWS SQS queues (jobs, webhooks) + DLQs; create IAM user with scoped policy; store credentials in secrets.
- [x] Stand up PostHog analytics (keys configured, env files seeded, instrumentation ready).
- [x] Configure Better Stack logging & uptime alerts (log helper added, monitors created).

## 6. DevOps & CI/CD (ref `docs/deployment/DEPLOYMENT-CICD.md`)
- [ ] Implement GitHub Actions workflows (ci.yml, deploy-web.yml, deploy-api.yml, db-migrate.yml, release.yml). *(TODO: Draft workflows, configure secrets, add status checks — see `docs/deployment/IMPLEMENTATION-CHECKLIST.md` §1.)*
- [ ] Define environment branches (dev/staging/main) with deployment approvals. *(TODO: Document branch strategy, update repo settings, configure protections — see `docs/deployment/IMPLEMENTATION-CHECKLIST.md` §2.)*
- [ ] Add pnpm scripts (`deploy:*`, `rollback:*`, `test:*`) and Turbo setup. *(TODO: Create scripts, integrate with Turbo pipeline, document usage — see `docs/deployment/IMPLEMENTATION-CHECKLIST.md` §3.)*
- [ ] Configure staging/production Pages + Workers projects with environment variables. *(TODO: Map env vars, script uploads, validate deployments — see `docs/deployment/IMPLEMENTATION-CHECKLIST.md` §4.)*
- [ ] Update queues-related scripts/services to use AWS SQS (enqueue/dequeue helpers, IAM credentials). *(TODO: Refactor queue clients, inject credentials, add tests — see `docs/deployment/IMPLEMENTATION-CHECKLIST.md` §5.)*
- [ ] Set up monitoring dashboards, alerts, and rollback procedures. *(TODO: Build Better Stack dashboards, define alert policies, document rollback steps — see `docs/deployment/IMPLEMENTATION-CHECKLIST.md` §6.)*

## 7. Quality Engineering (ref `docs/guides/TESTING-STRATEGY.md`)
- [ ] Configure Vitest across packages with MSW mocks and coverage thresholds. *(TODO: Normalize Vitest config, add MSW handlers, enforce coverage — see `docs/guides/QE-IMPLEMENTATION-CHECKLIST.md` §1.)*
- [ ] Build integration test harness with Neon shadow DB + fixtures. *(TODO: Provision shadow DB, write data loaders, add teardown utilities — see `docs/guides/QE-IMPLEMENTATION-CHECKLIST.md` §2.)*
- [ ] Author Playwright suites (desktop/mobile) with data reset hooks + artifact retention. *(TODO: Script Playwright setup, add test data API, configure artifacts — see `docs/guides/QE-IMPLEMENTATION-CHECKLIST.md` §3.)*
- [ ] Establish contract-testing pipeline and JSON schema validation. *(TODO: Generate schemas, add validator, wire to CI stage — see `docs/guides/QE-IMPLEMENTATION-CHECKLIST.md` §4.)*
- [ ] Implement k6 load tests + Lighthouse automation. *(TODO: Author k6 scenarios, add Lighthouse CI config, schedule runs — see `docs/guides/QE-IMPLEMENTATION-CHECKLIST.md` §5.)*
- [ ] Add security scans (Snyk, OWASP ZAP) to CI nightly. *(TODO: Configure scan workflows, manage API tokens, triage alerts — see `docs/guides/QE-IMPLEMENTATION-CHECKLIST.md` §6.)*
- [ ] Document tests/README, flake quarantine policy, QA runbooks. *(TODO: Write testing README, define flake process, compile QA runbook — see `docs/guides/QE-IMPLEMENTATION-CHECKLIST.md` §8.)*

## 8. Security & Compliance (ref `docs/guides/SECURITY-CHECKLIST.md`)
- [ ] Adopt Argon2id hashing (validate Workers compatibility) + enforce reset policies. *(TODO: Verify hashing libs, update auth pipeline, extend password reset — see `docs/guides/SECURITY-IMPLEMENTATION-CHECKLIST.md` §1.)*
- [ ] Implement tenant isolation integration test + rate limiting middleware. *(TODO: Write multi-tenant test suite, add rate limiter middleware, validate coverage — see `docs/guides/SECURITY-IMPLEMENTATION-CHECKLIST.md` §1-2.)*
- [ ] Sanitize content, enforce CSP, secure cookies, log admin actions. *(TODO: Audit headers, add CSP config, harden cookies, expand admin audit logs — see `docs/guides/SECURITY-IMPLEMENTATION-CHECKLIST.md` §2.)*
- [ ] Encrypt sensitive columns (payments, KYC) using envelope encryption. *(TODO: Select KMS strategy, implement encryption helpers, migrate schema — see `docs/guides/SECURITY-IMPLEMENTATION-CHECKLIST.md` §3.)*
- [ ] Enforce WAF/Zero Trust, rotate secrets, audit dependencies. *(TODO: Configure Access/WAF policies, schedule rotations, add dependency scans — see `docs/guides/SECURITY-IMPLEMENTATION-CHECKLIST.md` §§4-5.)*
- [ ] PCI DSS SAQ-A posture: tokenized payments, webhook signature validation, dispute log. *(TODO: Integrate tokenized payment provider, add signature checks, log disputes — see `docs/guides/SECURITY-IMPLEMENTATION-CHECKLIST.md` §6.)*
- [ ] Incident response runbook, PagerDuty/SMS escalation, quarterly chaos exercise. *(TODO: Draft IR plan, configure escalation chain, schedule chaos drills — see `docs/guides/SECURITY-IMPLEMENTATION-CHECKLIST.md` §7.)*
- [ ] Privacy compliance: consent logging, DSAR anonymization flow, bilingual policies. *(TODO: Build consent storage, automate DSAR workflow, author bilingual policy docs — see `docs/guides/SECURITY-IMPLEMENTATION-CHECKLIST.md` §8.)*

## 9. Program Management
- [ ] Break each checkbox into tracker tickets with owners/dates. *(TODO: Create ticket tracker, assign owners, capture timelines — see `docs/ops/PROGRAM-MANAGEMENT-CHECKLIST.md` §1.)*
- [ ] Align with sprint roadmap (24 sprints) and update burndown weekly. *(TODO: Publish roadmap doc, set burndown cadence, automate reporting — see `docs/ops/PROGRAM-MANAGEMENT-CHECKLIST.md` §2.)*
- [ ] Establish weekly architecture/security/testing reviews. *(TODO: Schedule ceremonies, define agendas, record outcomes — see `docs/ops/PROGRAM-MANAGEMENT-CHECKLIST.md` §3.)*
- [ ] Track KPIs (merchants, ARR, churn) in ops dashboard once metrics available. *(TODO: Define KPI sources, build dashboard, set refresh policy — see `docs/ops/PROGRAM-MANAGEMENT-CHECKLIST.md` §4.)*
- [ ] Schedule post-launch support (+24h watch) and customer success onboarding. *(TODO: Draft support rota, prepare CS playbook, align staffing — see `docs/ops/PROGRAM-MANAGEMENT-CHECKLIST.md` §5.)*

## 10. Catalog & Storefront (Sprints 3–4)
- [x] Extend catalog schema (variants, collections, tags) and update migrations.
- [x] Implement product media storage via R2 + image ordering.
- [x] Build merchant catalog UI (list + detail editor) with PostHog instrumentation. *(Admin catalog now ships with filters, bulk actions, variant/media editors, PostHog events, and Playwright coverage.)*
- [x] Expose storefront product APIs and initial customer-facing pages.
- [ ] Wire inventory adjustments, low-stock alerts, and usage counters. *(Inventory adjustments + alert queuing ready; delivery wiring and usage counters pending.)*
- [ ] Implement multi-step onboarding wizard and checklist. *(TODO: Connect onboarding UX to API steps, persist progress, add checklist automation.)*
- [ ] Expand automated tests (Vitest/Playwright) for catalog & storefront flows. *(TODO: Author end-to-end flows, cover storefront pages, add CI gating.)*

---

**Usage:** Update status inline, link to tickets, and version-control this document as work progresses.
