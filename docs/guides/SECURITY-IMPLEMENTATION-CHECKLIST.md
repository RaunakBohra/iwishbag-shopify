# 🛡️ Security & Compliance Implementation Checklist

> Convert the security checklist into actionable workstreams for hashing, isolation, CSP, encryption, WAF, PCI posture, incident response, and privacy.

## 1. Authentication Hardening
- [ ] Adopt Argon2id hashing in Workers (validate package compatibility or use WebAssembly build).
- [ ] Enforce password reset expiry + single-use tokens (KV-backed).
- [ ] Require 2FA for platform admins; add UI prompt + enforcement.
- [ ] Sync RBAC matrix with seed scripts; add tests to ensure parity.
- [ ] Add tenant isolation integration test covering cross-tenant access denial.

## 2. Application Safeguards
- [ ] Ensure Zod validation covers all routes; reject unknown fields (strict mode).
- [ ] Sanitize rich text inputs using DOMPurify (server-side) for pages/blog.
- [ ] Configure Content-Security-Policy headers (script-src nonce, img-src, connect-src).
- [ ] Harden cookies with `SameSite=Lax`, `Secure`, `HttpOnly` flags where applicable.
- [ ] Implement global + per-tenant rate limiting middleware and log thresholds.
- [ ] Audit admin actions (plan changes, impersonation) and store in `audit_logs`.

## 3. Data Protection
- [ ] Verify all Prisma connections enforce SSL (`sslmode=require`).
- [ ] Implement envelope encryption helpers for payments/KYC columns.
- [ ] Schedule Neon PITR restore drill + document procedure.
- [ ] Configure R2 to back up to external S3 bucket daily.
- [ ] Finalize data retention policy per table and automate purges.

## 4. Infrastructure Security
- [ ] Gate Super Admin dashboard behind Cloudflare Access (Zero Trust).
- [ ] Enable Cloudflare WAF managed rules + custom limits for API paths.
- [ ] Monitor Workers CPU/runtime via Better Stack; alert on anomalies.
- [ ] Implement 90-day rotation workflow for key tokens (Cloudflare, Neon, Sparrow).
- [ ] Ensure secrets managed via Cloudflare Secrets/GitHub; audit repo for stray `.env`.

## 5. Supply Chain & Dependencies
- [ ] Integrate Dependabot for npm + Actions.
- [ ] Schedule weekly `pnpm audit` run (CI job) with triage workflow.
- [ ] Add Snyk scanning (optional) for deeper dependency insight.
- [ ] Use Subresource Integrity hashes for any third-party scripts/styles.

## 6. Payment Security (PCI)
- [ ] Confirm tokenized payment flows (client handles card data; server uses tokens).
- [ ] Validate and log webhook signatures from payment providers.
- [ ] Mask sensitive payment data in logs/monitoring.
- [ ] Maintain dispute log + resolution workflow.
- [ ] Create PCI compliance dossier (evidence checklist).

## 7. Incident Response & Monitoring
- [ ] Update incident response runbook (`docs/ops/INCIDENT-RESPONSE.md`).
- [ ] Configure Better Stack + PagerDuty alerts for auth failures, IP anomalies.
- [ ] Capture security metrics (failed login counts, OTP attempts).
- [ ] Schedule quarterly chaos/security exercises; log findings.
- [ ] Automate post-release 24h security watch assignments.

## 8. Privacy & Data Rights
- [ ] Publish bilingual privacy policy/terms and version in `policies` table.
- [ ] Automate DSAR anonymization script with audit logs.
- [ ] Track consent changes with timestamp/IP.
- [ ] Ensure log retention meets Nepal financial regulations (min 1 year).
- [ ] Provide merchant-facing privacy documentation in dashboard.

## 9. Release Governance
- [ ] Require security review sign-off on release tickets.
- [ ] Update changelog highlighting security fixes.
- [ ] Notify merchants about high-severity patches via email/banner.
- [ ] Document release watch checklist for on-call team.
