# 🔐 Secrets Handling (KISS Edition)

> Keep it simple: developers store secrets locally in ignored `.env` files, and CI/Workers use GitHub + Cloudflare secrets. No external password managers required.

---

## 1. Working Principle

1. **Local development** – copy each workspace’s `.env.example` file to `.env.local` and fill in secrets manually. These files are ignored by git, so they stay on your machine.
2. **Source control / CI** – add the same secrets to GitHub repository secrets (`Settings → Secrets and variables → Actions`). Use environment scoping if you want different values for staging vs production.
3. **Cloudflare Workers / GitHub** – run `pnpm secrets:sync <service> --env=<env>` (preferred) to push updates; fall back to `gh secret set` / `npx wrangler secret put` if the script doesn’t support the service yet.
4. **Backups** – keep an encrypted archive (e.g., `secrets-YYYY-MM-DD.7z` protected with a team-shared passphrase) containing the latest `.env.local` values so new teammates can bootstrap without pinging everyone.

## 2. Reference Table

| Service | Secret(s) | Local File | GitHub Secret | Cloudflare Secret | Notes |
|---------|-----------|------------|---------------|-------------------|-------|
| Cloudflare | `CLOUDFLARE_API_TOKEN` | `scripts/.env.local` | `CLOUDFLARE_API_TOKEN` | n/a | Needed for Deployments + wrangler. |
| Cloudflare KV (temp sessions) | n/a | managed via wrangler | n/a | binding `TEMP` | Used for 2FA + password reset flows; create namespace and update `wrangler.toml`. |
| Neon (dev) | `DATABASE_URL`, `DATABASE_POOLED_URL`, `DATABASE_URL_APP_USER`, `DATABASE_URL_APP_ADMIN` | `api/.env.local`, `api/.env.dev` | `DATABASE_URL_DEV`, `DATABASE_POOLED_URL_DEV` (optional) | same names | Dev branch connection + RLS helpers. |
| Neon (staging) | `DATABASE_URL_STAGING`, `DATABASE_POOLED_URL` | `api/.env.local`, `api/.env.staging` | `DATABASE_URL_STAGING` | `DATABASE_URL_STAGING` | Staging migrations + Workers. |
| Neon (prod) | `DATABASE_URL`, `DATABASE_POOLED_URL` | `api/.env.local`, `api/.env.prod` | same names | same names | Production migrations + Workers. |
| AWS SES | `SES_SMTP_USER`, `SES_SMTP_PASS` | `api/.env.local` | same names | same names | Create per-environment credentials in AWS console. |
| AWS SQS | `AWS_SQS_ACCESS_KEY_ID`, `AWS_SQS_SECRET_ACCESS_KEY`, queue URLs | `api/.env.local` | same names | same names | Queue URLs can stay in code as constants if non-secret. |
| Postmark (inventory alerts & auth emails) | `POSTMARK_API_TOKEN`, `INVENTORY_ALERT_EMAIL_FROM`, `INVENTORY_ALERT_EMAIL_TO`, `PASSWORD_RESET_EMAIL_FROM` | `workers/inventory-alerts/.env.local`, `api/.env.local` | `POSTMARK_API_TOKEN`, `INVENTORY_ALERT_EMAIL_FROM`, `INVENTORY_ALERT_EMAIL_TO`, `PASSWORD_RESET_EMAIL_FROM` | same names | Used for low-stock alerts and password reset emails. |
| Alert Webhook | `INVENTORY_ALERT_WEBHOOK_URL` | `workers/inventory-alerts/.env.local` | `INVENTORY_ALERT_WEBHOOK_URL` | `INVENTORY_ALERT_WEBHOOK_URL` | Optional webhook endpoint for external integrations. |
| PostHog | `POSTHOG_API_KEY`, `POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY` | `api/.env.local`, `frontend/.env.local` | `POSTHOG_API_KEY`, `POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_KEY` | `POSTHOG_API_KEY` | Client key is public; keep server key secret. |
| Better Stack | `BETTERSTACK_TOKEN`, `BETTERSTACK_LOGS_TOKEN` | `scripts/.env.local` | same names | same names | Only required once monitoring is enabled. |
| JWT | `JWT_SECRET` | `api/.env.local` | `JWT_SECRET` | `JWT_SECRET` | Rotate manually when needed. |
| Sparrow SMS | `SPARROW_SMS_TOKEN` | `api/.env.local` | `SPARROW_SMS_TOKEN` | `SPARROW_SMS_TOKEN` | Pending provider approval. |
| PagerDuty | `PAGERDUTY_INTEGRATION_KEY` | `scripts/.env.local` | `PAGERDUTY_INTEGRATION_KEY` | `PAGERDUTY_INTEGRATION_KEY` | Only after PagerDuty service exists. |

For any new secret, make sure to:
- Add it to the relevant `.env.example` file so teammates know it exists.
- Document the GitHub/Cloudflare secret names in this table.

## 3. Minimal Rotation Flow
1. Regenerate the value in the upstream dashboard (AWS, Cloudflare, etc.).
2. Update your local `.env.local` and share the encrypted archive update.
3. Run the appropriate sync script (see `docs/secrets/SECRETS-MATRIX.md`) to push GitHub and Cloudflare secrets; fall back to `gh secret set` / `wrangler secret put` if needed.
4. Verify the app deploys/tests successfully, then delete the old value.

## 4. Quick FAQ
- **Where are secrets backed up?** → Encrypted 7z archive in our shared drive, updated whenever credentials change.
- **How do I add a new secret?** → Update `.env.example`, set it locally, add to GitHub/Cloudflare, and record it in the table above.
- **Do we need a secrets sync script?** → Yes. Use the `pnpm secrets:sync` utilities described in the matrix; manual steps are the fallback.

## 5. Service Notes
- **Neon** – Console lives at <https://console.neon.tech>. When you rotate a database password, update `api/.env.local`, GitHub secrets, and the relevant Cloudflare Worker secrets right away.
- **AWS** – IAM user `iwishbag-store-worker` owns the SQS access keys; keep the latest CSV in the encrypted archive. Queue URLs are public and can be hard-coded.
- **PostHog** – Free tier is fine for now. Production server key should live in GitHub/Workers only; local `.env` can use staging key.
- **Better Stack** – Hold off on adding secrets until monitoring is enabled; meanwhile keep tokens in the encrypted backup only.
- **Sparrow SMS / PagerDuty** – Add rows to the reference table as soon as credentials are issued.
---

### Usage Guidelines
1. Never commit raw secrets; `.env.example` files should only contain placeholder text.  
2. When sharing with teammates, use the encrypted archive or direct message—avoid plaintext channels.  
3. Keep GitHub/Cloudflare secrets in sync whenever local values change.  
4. Update this doc’s reference table whenever a new secret is introduced.
