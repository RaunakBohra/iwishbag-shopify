# 🧩 Supporting Services Provisioning Checklist

> Track ownership, environment rollout, and credentials for third-party services that back the platform.

| Service      | Primary Owner    | Environments | Provisioning / Setup Tasks                                                                 | Credential Storage / Notes                              | Owner Confirmation (Week 1) | Status |
|--------------|------------------|--------------|---------------------------------------------------------------------------------------------|---------------------------------------------------------|------------------------------|--------|
| Storefront Search (built-in) | Platform Eng     | all | Verify Prisma-powered search queries during API smoke tests; no external infra to provision. | N/A – uses primary Postgres connection. | Week 1 API walkthrough | ✅ |
| PostHog      | Analytics Lead   | dev → staging → prod | Confirm project settings, enable EU data residency, map event taxonomy, share client/server keys. | Store keys in `.env.local`; mirror to GitHub/Cloudflare secrets via `pnpm secrets:sync posthog`. | Pending – confirm during Week 1 analytics sync | ✅ (server key pending prod rotation before launch) |
| Better Stack | SRE              | staging → prod | Review existing monitors, add storefront endpoints, enable on-call routing.                 | Keep tokens in `.env.local`; seed GitHub/Cloudflare secrets (`gh secret set` + `wrangler secret put`). | Pending – confirm handoff during Week 1 SRE standup | ⏳ (add storefront uptime monitor + webhook test) |
| AWS SES      | Platform Eng     | staging → prod | Promote domain out of sandbox, generate IAM SMTP users per env, set sending quotas.         | Store SMTP creds per env in `.env.local`; sync via `scripts/secrets/push-aws.sh`. | Pending – align w/ domain verification owner | ⏳ (sandbox exit scheduled 2025-10-22) |
| Sparrow SMS  | Ops              | staging → prod | Finalize sender IDs, accept pricing, run end-to-end OTP + marketing campaign test.          | Place API token in `.env.local` once issued; sync manually (Better Stack flow). | Pending – awaiting provider approval email | 🔴 (follow up w/ Sparrow acct mgr by 2025-10-18) |
| DNSimple     | Platform Eng     | prod          | Create automation token, configure zone delegation scripts, set alerts on changes.          | Keep token in `.env.local`; add GitHub secret `DNSIMPLE_TOKEN` when automation is ready. | Pending – add to Week 1 infra sync agenda | ⏳ (token request in flight; ETA 2025-10-16) |
| PagerDuty    | SRE              | prod          | Create service for Store API, configure escalation policy, add Better Stack webhook.        | Store integration keys in `.env.local`; copy to GitHub/Cloudflare when alerts go live. | Pending – escalation policy review scheduled (Week 1 Thu) | ⏳ (needs Better Stack webhook verification) |
| Postmark     | Platform Eng     | dev → staging → prod | Configure transactional stream for password reset + inventory alerts; verify sender domain. | Token stored in `.env.local`; sync to GitHub/Cloudflare via `pnpm secrets:sync postmark`. | Pending – coordinate with Ops for sender identity | ⏳ (needs production sender verification) |

**Next actions**
- Confirm owners accept responsibility for their rows.
- Move status to ✅ only after secrets are mirrored to Cloudflare + GitHub and smoke tests succeed.

**Action Tracker**
- Better Stack (SRE) — add storefront uptime monitor + verify webhook delivery (Due: 2025-10-16).
- AWS SES (Platform Eng) — complete sandbox exit request, generate IAM SMTP credentials, run test send (Due: 2025-10-18).
- Sparrow SMS (Ops) — follow up with account manager regarding sender ID approval and pricing acceptance (Due: 2025-10-18).
- DNSimple (Platform Eng) — obtain automation token and document scripts for zone delegation (Due: 2025-10-16).
- PagerDuty (SRE) — finalize escalation policy and test Better Stack integration (Due: 2025-10-17).
- PostHog (Analytics Lead) — rotate production server key before launch and sync via `pnpm secrets:sync posthog` (Due: pre-launch).
- Postmark (Platform Eng) — verify sender domains and update password reset stream configuration (Due: 2025-10-18).
