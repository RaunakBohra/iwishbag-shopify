# 🛠️ Platform Setup Runbook

> Follow this checklist to bootstrap the cloud foundation. Run commands locally with appropriate credentials. Update ticket links/status as you complete each step.

---

## 1. Prerequisites

- [ ] Install latest `wrangler` CLI (`npm i -g wrangler`).
- [ ] Install `neonctl` (`npm i -g neonctl`) or ensure access to the Neon dashboard.
- [ ] Install `cloudflared` (for Access testing) and `pnpm`.
- [ ] Authenticate CLI tools:
  ```bash
  wrangler login
  neonctl auth login
  ```
- [ ] Confirm you have administrator access to Cloudflare, Neon, AWS, Sparrow SMS, Better Stack, PostHog, DNSimple, PagerDuty.

---

## 2. Cloudflare Foundation

1. **Workers + KV + Queues**
   ```bash
   wrangler init iwishbag-api --type=javascript
   wrangler kv namespace create SESSIONS
   wrangler kv namespace create RATE_LIMIT
   wrangler d1 create iwishbag-cache # optional cache layer
   ```
   - [ ] Record namespace IDs in `docs/secrets/cloudflare.md`.
   - [ ] Add to `wrangler.toml` in `apps/api`.
   - ✅ Provisioned namespaces:  
     • `NEPSHOP_SESSIONS` → `8699ef99d1e14bfba4ce5bf8327e2f4e`  
     • `NEPSHOP_RATE_LIMIT` → `0a6f1312e49d4fa6a85b525f513ce527`

2. **Durable Objects**
   - [ ] Define Durable Object classes (Cart, RateLimiter, TenantMetrics) in codebase.
   - [ ] Run `wrangler deploy --minify` to register bindings.

3. **R2 Buckets**
   ```bash
   wrangler r2 bucket create nepshop-product-media
   wrangler r2 bucket create nepshop-proof-of-delivery
   wrangler r2 bucket create nepshop-backups
   ```
   - [ ] Note public domains for CDN usage.
   - ✅ Buckets created (Standard storage class).

4. **Pages Projects & DNS**
   ```bash
   wrangler pages project create nepshop-web
   wrangler pages project create nepshop-merchant
   wrangler pages project create nepshop-storefront
   ```
   - [ ] Link GitHub repo, set build command (`pnpm build` with path filters).
   - [ ] Configure production → `main`, preview → all branches.
   - ✅ Projects provisioned with production branch `main`:
     • `iwishbag-web`  
     • `iwishbag-merchant`  
     • `iwishbag-storefront`

5. **Zero Trust / Access**
   - ✅ Access application configured for `internal-admin.iwishbag.store`; Google Workspace allow-list applied.
   - ✅ DNS records (`@`, `www`, `merchant`, `api`, wildcard storefront) added in Cloudflare with proxy + HTTPS enforcement.

---

## 3. Neon PostgreSQL

1. **Project & Branches**
   - ✅ Project `iwishbag.store` with branches `main`, `staging`, `dev` created (via Neon dashboard).
2. **Connection Strings**
   - ✅ Direct + pooled URLs stored in 1Password (`Neon Prod/Staging/Dev` entries).

3. **Roles & Extensions**
   - [ ] Run SQL from `docs/database/NEON-MULTI-TENANT.md` to create roles, enable RLS, set default privileges.
   - [ ] Install extensions: `pgcrypto`, `uuid-ossp`, `pg_stat_statements`.

4. **Monitoring**
   - ✅ PITR enabled; nightly snapshots scheduled in Neon.

---

## 4. Supporting Services & Queues

- **MeiliSearch**
  - [ ] Deploy managed instance (Fly.io/DigitalOcean) or self-host; note `MEILI_HOST`, `MEILI_MASTER_KEY`.
- **PostHog**
  - ✅ Project created; client host/key added to `frontend/.env.local`.
  - ✅ Server env template seeded (`api/.dev.vars`); awaiting secure PostHog API key entry.
- **Better Stack**
  - ✅ Tokens stored; log helper at `api/src/lib/logging.ts`; monitors provisioned via script.
- **AWS SES**
  - ✅ Domain `iwishbag.store` verified; SMTP credentials stored in vault.
- **Sparrow SMS**
  - [ ] Register sender IDs, fetch API token.
- **DNSimple**
  - [ ] Ensure API token and account ID for automation.
- **PagerDuty**
  - [ ] Create service + escalation policy for Sev1 incidents.

- **AWS SQS (replacing Cloudflare Queues)**
  - ✅ Queues + DLQs created with redrive policies; IAM user `iwishbag-store-worker` provisioned; access keys stored in vault.

Document all credential locations in `docs/secrets/README.md` (do not store actual secrets in repo).

---

## 5. Secrets Distribution

- [ ] Add Cloudflare Secrets:
  ```bash
  wrangler secret put DATABASE_URL
  wrangler secret put DATABASE_POOLED_URL
  wrangler secret put JWT_SECRET
  # ...repeat for all credentials
  ```
- [ ] Configure GitHub Actions repository secrets:
  - `CLOUDFLARE_API_TOKEN`, `NEON_API_KEY`, `SES_SMTP_USER`, `SES_SMTP_PASS`, `SPARROW_SMS_TOKEN`, `MEILI_MASTER_KEY`, `POSTHOG_API_KEY`, `BETTERSTACK_TOKEN`, `PAGERDUTY_INTEGRATION_KEY`.
  - `AWS_SQS_ACCESS_KEY_ID`, `AWS_SQS_SECRET_ACCESS_KEY`, `AWS_SQS_REGION`, `AWS_SQS_JOBS_URL`, `AWS_SQS_WEBHOOKS_URL`, `AWS_SQS_DLQ_JOBS_URL`, `AWS_SQS_DLQ_WEBHOOKS_URL`.
- [ ] Update `docs/PROJECT-TODO.md` with links to secret storage locations.

---

## 6. Validation Checklist

- [ ] Run `wrangler whoami` to confirm Cloudflare auth.
- [ ] Run `neonctl connection-string` to confirm DB access.
- [ ] Deploy sample Worker to staging (`wrangler deploy --env staging`) and verify via curl.
- [ ] Upload test object to R2 bucket and confirm retrieval via signed URL.
- [ ] Send SES sandbox test email; ensure DKIM/SPF pass.
- [ ] Trigger Sparrow SMS test message to verify sender ID.
- [ ] Create Better Stack heartbeat and ensure alert triggers to PagerDuty.
- [ ] Publish test message to SQS queue and confirm Worker/Lambda consumer processes it; verify DLQ redrive.

---

## 7. Handover

- [ ] Log outcomes, URLs, and remaining gaps in the tracker ticket.
- [ ] Update `docs/PROJECT-TODO.md` checkboxes for completed provisioning tasks.
- [ ] Share credentials locations with core team (secure channel).
- [ ] Schedule follow-up meeting to start Foundation Sprint engineering tasks.

---

*Last updated:* 2025-10-08  
*Owner:* Platform team (initial setup by DevOps/Lead Engineer)
