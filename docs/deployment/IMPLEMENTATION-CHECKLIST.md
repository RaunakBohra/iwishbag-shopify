# 🚀 DevOps & CI/CD Implementation Checklist

> Translate the deployment guide into assignable tasks for workflows, environments, and operational readiness.

## 1. GitHub Actions Workflows
- [ ] Author `.github/workflows/ci.yml` (lint, test, type-check, coverage upload).
- [ ] Create `deploy-web.yml` for Next.js apps with manual approval on `main`.
- [ ] Create `deploy-api.yml` to deploy Workers via Wrangler with environment matrix.
- [ ] Build `db-migrate.yml` to run Prisma migrations on staging/prod with approvals.
- [ ] Add `release.yml` to tag versions, publish release notes, and bump changelog.
- [ ] Configure caching, secrets, and concurrency groups to prevent overlap.

## 2. Branch & Environment Strategy
- [ ] Document branch protections (dev → staging → main) and enforce required reviews. *(Draft policy in `docs/ops/GITHUB-GUARDRAILS.md` — branch protections:*
  * *`dev`: require status checks (CI), allow squash/merge, no review requirement.*
  * *`staging`: require 1 approving review, status checks (CI + Playwright), restrict force pushes.*
  * *`main`: require 2 approving reviews, status checks (CI + Playwright + coverage), signed commits optional, restrict to merge queue once ready.)*
- [ ] Configure GitHub environment approvals + secrets per environment.
- [ ] Update `docs/PROJECT-TODO.md` with branch workflow diagram referencing this checklist.
- [ ] Establish merge queue or required status checks for main. *(Target: enable GitHub merge queue once CI timings <15m; until then enforce required checks.)*

## 3. pnpm/Turbo Tooling
- [ ] Add `pnpm` scripts (`deploy:*`, `rollback:*`, `test:*`) aligned with workflows.
- [ ] Configure Turborepo pipeline for cache sharing across CI steps.
- [ ] Document developer usage in `README` / `docs/guides/DEVELOPMENT-SETUP.md`.

## 4. Cloudflare Deployments
- [ ] Script environment variable sync to Workers/Pages via `wrangler` commands.
- [ ] Configure staging/production Pages projects and Workers routes with env bindings.
- [ ] Add preview deployments for pull requests (Pages + Workers).
- [ ] Ensure R2 bucket bindings and KV namespaces are injected per environment.

## 5. Queue & Infrastructure Scripts
- [ ] Update enqueue/dequeue helpers to target AWS SQS (jobs/webhooks) with per-env URLs.
- [ ] Provide IAM credential rotation script tied to secrets matrix.
- [ ] Add smoke tests or health checks for queue consumers post-deploy.

## 6. Monitoring & Rollback
- [ ] Create Better Stack dashboards for API, Workers, Pages, queues.
- [ ] Configure PagerDuty alert routing for Sev1 incidents triggered from CI/monitors.
- [ ] Document rollback procedures (Cloudflare version rollback, `wrangler rollback`, redeploy previous Pages build).
- [ ] Add automated notification (Slack/email) on deploy success/failure.

## 7. Validation & Sign-off
- [ ] Dry-run workflows on dev branch; ensure secrets resolved.
- [ ] Capture deployment runbook (step-by-step) in `docs/deployment/DEPLOYMENT-CICD.md`.
- [ ] Update `docs/PROJECT-TODO.md` DevOps section with completion links.
- [ ] Coordinate launch readiness review with Platform + SRE teams.
