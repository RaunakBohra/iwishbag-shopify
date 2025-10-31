# 🚀 Release Smoke Checklist

> Execute after each Prisma migration promotion (staging or production). Record results with timestamps and owner initials.

## Pre-flight
- Confirm `.env.dev` / `.env.staging` reference the latest Neon connection strings (see `docs/secrets/SECRETS-MATRIX.md`).
- Announce migration window in `#platform` Slack with start/end time, on-call, rollback owner.
- Pause automated deploys during the window.

## Smoke Steps
| Step | Owner | Command / Endpoint | Expected Result | Notes |
|------|-------|--------------------|-----------------|-------|
| API Health | Platform Eng | `GET https://<env-api>/health` | `{"ok":true}` | Capture response + timestamp in release log. |
| Catalog CRUD | API Eng | `POST /v1/products`, `GET /v1/products/:id` | 201 created; 200 read with correct data | Include request IDs. |
| Worker Queue | Worker Eng | Enqueue sample to `catalog-events` | Worker logs success; inventory snapshot updated | Record Better Stack log link. |
| Test Suite | QE | `pnpm --filter iwishbag-store-api test` | All tests pass | Attach summary artifact. |

## Post-flight
- Re-enable deploy automations.
- Update release log with status, migration SHA, and any follow-up tasks.
- Notify stakeholders in Slack that the migration completed and smoke tests passed.

## Rollback Reference
- Neon: `neonctl branches rollback <branch> --to-sha <sha>`
- Cloudflare Workers: `pnpm deploy:rollback`
- Pages: trigger rollback via dashboard (link in `docs/deployment/DEPLOYMENT-CICD.md`).
