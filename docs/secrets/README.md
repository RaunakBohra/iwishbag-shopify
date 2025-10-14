# 🔐 Secrets Registry

> Store actual credentials in your password manager (e.g., 1Password, Bitwarden). Use this file to note what exists, where it lives, and who owns rotation.

---

## 1. Cloudflare
- **API Token (Workers + DNS + R2 + Pages + Access)**  
  - Location: 1Password vault `NepShop Infra` → item `Cloudflare API Token`  
  - Owner: DevOps lead  
  - Rotation cadence: 90 days  
  - Consumed by: Wrangler CLI, GitHub Actions (`CLOUDFLARE_API_TOKEN`)
- **Account ID**: `610762493d34333f1a6d72a037b345cf`
- **KV Namespaces**  
  - `NEPSHOP_SESSIONS` → `8699ef99d1e14bfba4ce5bf8327e2f4e`  
  - `NEPSHOP_RATE_LIMIT` → `0a6f1312e49d4fa6a85b525f513ce527`
- **R2 Buckets**  
  - `nepshop-product-media` (binding `nepshop_product_media`)  
  - `nepshop-proof-of-delivery` (binding `nepshop_proof_of_delivery`)  
  - `nepshop-backups` (binding `nepshop_backups`)
- **Cloudflare Access**  
  - App: `internal-admin.iwishbag.store`  
  - Policy: Allow → admin@nepshop.com, founder@nepshop.com (update as team grows)
- **Pages Projects**  
  - `nepshop-web`, `nepshop-merchant`, `nepshop-storefront` (production branch `main`)

## 2. Neon PostgreSQL
- **Project**: `iwishbag.store`  
- **Branches**: `main` (prod), `staging`, `dev`  
- **Connection URLs**: 1Password vault `NepShop Infra` → items  
  - `Neon Prod (iwishbag.store)` → pooled URI `postgresql://neondb_owner:…@ep-long-mud-a1yxup9r-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`  
  - `Neon Staging (iwishbag.store)` → pooled URI `postgresql://neondb_owner:…@ep-billowing-sea-a1x8aric-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`  
  - `Neon Dev (iwishbag.store)` → pooled URI `postgresql://neondb_owner:…@ep-fragrant-lake-a12tu03e-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`  
- **Notes**: PITR enabled; nightly snapshots configured via Neon console; keep direct URLs alongside pooled for migration tooling.

## 3. AWS (SQS, SES, etc.)
- **Account**: `iwishbag-store` (ID `988162738841`, region `ap-south-1`)  
- **IAM User**: `iwishbag-store-worker`  
  - Access key stored in 1Password item `AWS Access Key – iwishbag-store-worker` (from `iwishbag-store_accessKeys.csv`)  
  - GitHub Actions secrets:  
    - `AWS_SQS_ACCESS_KEY_ID` = `AKIAYWBJYE26PDT77T3S`  
    - `AWS_SQS_SECRET_ACCESS_KEY` = stored in CI secret manager  
  - Rotation cadence: 90 days
- **Queues** (once created)  
- Queues & URLs:
  - `iwishbag-store-jobs` → `https://sqs.ap-south-1.amazonaws.com/988162738841/iwishbag-store-jobs`
  - `iwishbag-store-jobs-dlq` → `https://sqs.ap-south-1.amazonaws.com/988162738841/iwishbag-store-jobs-dlq`
  - `iwishbag-store-webhooks` → `https://sqs.ap-south-1.amazonaws.com/988162738841/iwishbag-store-webhooks`
  - `iwishbag-store-webhooks-dlq` → `https://sqs.ap-south-1.amazonaws.com/988162738841/iwishbag-store-webhooks-dlq`
  - Update GitHub secrets: `AWS_SQS_JOBS_URL`, `AWS_SQS_WEBHOOKS_URL`, `AWS_SQS_DLQ_JOBS_URL`, `AWS_SQS_DLQ_WEBHOOKS_URL`
- **SES**
  - Domain `iwishbag.store` verified; SMTP credentials stored in 1Password item `AWS SES – iwishbag.store`
  - GitHub secrets: `SES_SMTP_USER`, `SES_SMTP_PASS`

## 4. Integrations
- **PostHog**
  - Project: `iwishbag-store`
  - Vault item: `PostHog – iwishbag-store`
  - GitHub/Env secrets:
    - `POSTHOG_HOST` = `https://us.i.posthog.com`
    - `NEXT_PUBLIC_POSTHOG_HOST` = `https://us.i.posthog.com`
    - `NEXT_PUBLIC_POSTHOG_KEY` = `phc_leTubckNTo9S8sc22WHoR2tCrNjLErit7FOR6ZY34Fy`
    - `POSTHOG_API_KEY` = phx_azbdeZdAkAUjhhIGlWJXwg6sHQisvaPxfzmpuMflrdktzwX
- **Better Stack**
  - Organization: `iwishbag-store`
  - Vault item: `Better Stack – iwishbag-store`
  - API tokens:
    - Uptime (REST) token: `Xkrnar12kbUfbHiyvbZG3bYr`
    - Logs/Telemetry token: `kny6K15TWYaGz73SK9HXFQZD`
  - GitHub secrets to add:
    - `BETTERSTACK_TOKEN` (uptime API)
    - `BETTERSTACK_LOGS_TOKEN` (telemetry ingestion)
  - Monitors to configure: `https://iwishbag.store`, `https://merchant.iwishbag.store`, `https://api.iwishbag.store/health`
- **JWT Secret**
  - Vault item: `API JWT Secret – iwishbag-store`
  - GitHub secret: `JWT_SECRET`
  - Cloudflare secret: `JWT_SECRET`
*** End Patch


---

### Usage Guidelines
1. Update this registry whenever secrets are created, rotated, or revoked.  
2. Never commit raw secrets; reference vault locations only.  
3. Include rotation owner and cadence so nothing expires unexpectedly.  
4. For GitHub Actions, note the secret names added (`Settings → Secrets and variables → Actions`).  
5. Archive old values in the vault with timestamps before rotating.
