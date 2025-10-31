# 🔐 Secrets Matrix (Manual Tracking)

| Service | Secret(s) | Local `.env` File(s) | GitHub Secret(s) | Cloudflare Secret(s) | Rotation Notes | Sync Procedure |
|---------|-----------|----------------------|------------------|----------------------|----------------|----------------|
| Cloudflare | `CLOUDFLARE_API_TOKEN` | `scripts/.env.local` | `CLOUDFLARE_API_TOKEN` | n/a | Rotate via Cloudflare dashboard when access scope changes. | Use `pnpm secrets:sync cloudflare` (see Scripts section) to push to GitHub once rotated; confirm in repo settings. |
| Cloudflare KV IDs | namespace IDs | none (public) | n/a | `wrangler.toml` bindings | Update if new namespaces created. | Update `wrangler.toml` and rerun `pnpm workers:publish`; no secret sync needed. |
| Neon (dev) | `DATABASE_URL`, `DATABASE_POOLED_URL`, `DATABASE_URL_APP_USER`, `DATABASE_URL_APP_ADMIN` | `api/.env.local`, `api/.env.dev` | `DATABASE_URL_DEV`, `DATABASE_POOLED_URL_DEV` (optional) | same names | Rotate when dev branch reset. | Use `pnpm secrets:sync neon --env=dev`; host `ep-fragrant-lake-a12tu03e`. |
| Neon (prod) | `DATABASE_URL`, `DATABASE_POOLED_URL` | `api/.env.local`, `api/.env.prod` | same names | same names | Rotate after regenerating connection string. | Run `pnpm secrets:sync neon --env=prod` to upload to GitHub + Cloudflare; verify via `wrangler secret list`. *(Current host: `ep-long-mud-a1yxup9r`.)* |
| Neon (staging) | `DATABASE_URL_STAGING` | `api/.env.local`, `api/.env.staging` | `DATABASE_URL_STAGING` | `DATABASE_URL_STAGING` | Sync with staging branch password changes. | Same as prod with `--env=staging`; record run in release log. *(Current host: `ep-billowing-sea-a1x8aric`.)* |
| AWS SQS | `AWS_SQS_ACCESS_KEY_ID`, `AWS_SQS_SECRET_ACCESS_KEY` | `api/.env.local` | same names | same names | Rotate IAM user keys quarterly. | Use `scripts/secrets/push-aws.sh` to sync both GitHub and Workers; attach IAM ARN + rotation date in Slack thread. |
| AWS SES | `SES_SMTP_USER`, `SES_SMTP_PASS` | `api/.env.local` | same names | same names | Rotate when AWS enforces or after incidents. | Same process as SQS; additionally update SES console sending credentials doc. |
| PostHog | `POSTHOG_API_KEY`, `POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY` | `api/.env.local`, `frontend/.env.local` | `POSTHOG_API_KEY`, `POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY` | `POSTHOG_API_KEY` | Client key is safe to expose; server key should rotate bi-annually. | Run `pnpm secrets:sync posthog` (uploads both server/client keys); confirm `NEXT_PUBLIC_*` values in Pages Env. |
| Better Stack | `BETTERSTACK_TOKEN`, `BETTERSTACK_LOGS_TOKEN` | `scripts/.env.local` | same names | same names | Rotate when adding/removing team members. | Manual: use `gh secret set` + `wrangler secret put`; update status in Supporting Services doc with timestamp. |
| Sparrow SMS | `SPARROW_SMS_TOKEN` | `api/.env.local` | `SPARROW_SMS_TOKEN` | `SPARROW_SMS_TOKEN` | Await initial issuance, then rotate per provider guidance. | Pending token; once issued, follow Better Stack manual process and log provider confirmation. |
| Postmark | `POSTMARK_API_TOKEN`, `PASSWORD_RESET_EMAIL_FROM` | `api/.env.local`, `workers/inventory-alerts/.env.local` | `POSTMARK_API_TOKEN`, `PASSWORD_RESET_EMAIL_FROM` | `POSTMARK_API_TOKEN`, `PASSWORD_RESET_EMAIL_FROM` | Rotate when credentials change or sender domains updated. | Use `pnpm secrets:sync postmark` (to script) or manual `gh secret set` + `wrangler secret put`; confirm worker + API env updated. |
| DNSimple | `DNSIMPLE_TOKEN` | `scripts/.env.local` | `DNSIMPLE_TOKEN` | `DNSIMPLE_TOKEN` | Rotate annually or when scopes change. | Manual sync; ensure Pages/Workers env updated via `wrangler secret put`. Track expiry in infra calendar. |
| PagerDuty | `PAGERDUTY_INTEGRATION_KEY` | `scripts/.env.local` | `PAGERDUTY_INTEGRATION_KEY` | `PAGERDUTY_INTEGRATION_KEY` | Rotate when service key regenerated. | Manual sync with dual approval; document in on-call runbook upon change. |
| JWT | `JWT_SECRET` | `api/.env.local` | `JWT_SECRET` | `JWT_SECRET` | Rotate if compromised; document new value timestamp. | `pnpm secrets:sync auth --env=<target>`; notify QA to refresh tokens post-rotation. |

**Sync Workflow**
1. Update local `.env` files with the new secret; run `pnpm secrets:validate` to ensure required keys are present.
2. Execute the relevant sync script (see table) to push values to GitHub and Cloudflare Workers/Pages.
3. Verify secrets in target platforms (`gh secret list`, `wrangler secret list`, GitHub Actions variable UI).
4. Record rotation in this matrix (date/owner) and announce in `#platform` for awareness.
5. If automation unavailable, fall back to manual `gh secret set` + `wrangler secret put`, tracking commands in `docs/ops/SECRETS-RUNBOOK.md` (to author).

Update this table whenever a new secret is introduced or an existing secret changes location.
