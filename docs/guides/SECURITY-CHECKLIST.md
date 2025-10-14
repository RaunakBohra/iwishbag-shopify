# 🔒 Security Checklist

> **Version:** 1.0
> **Status:** In Progress

Operational playbook for keeping the platform secure. Mark each checkbox when complete per release cycle unless noted otherwise.

---

## 0. Governance

- [ ] Assign Security Champion per squad.
- [ ] Maintain incident response runbook in `/docs/ops/INCIDENT-RESPONSE.md`.
- [ ] Review threat model quarterly; log updates in changelog.

---

## 1. Authentication & Authorization

- [ ] Password hashing uses Argon2id (fall back to bcrypt only if Workers limitation persists).
- [ ] Enforce password reset link expiry (15 minutes) and one-time use.
- [ ] Require 2FA for platform admins; optional but encouraged for merchants.
- [ ] RBAC matrix documented in `AUTHENTICATION.md` stays in sync with `permissions` seed script.
- [ ] Add integration test verifying tenant isolation (403 on cross-tenant resource access).

---

## 2. Application Security

- [ ] Use Zod validation for every request payload; reject unknown fields.
- [ ] Sanitize rich text inputs (blog, pages) with DOMPurify on server.
- [ ] Add `Content-Security-Policy` headers with strict mode (no inline scripts).
- [ ] Enable `SameSite=Lax`, `Secure`, `HttpOnly` on cookies (where used).
- [ ] Implement global rate limiting middleware per IP + tenant.
- [ ] Log admin-sensitive actions (plan changes, impersonation) to `audit_logs`.

---

## 3. Data Security

- [ ] Database connections enforce SSL (`sslmode=require`).
- [ ] Sensitive columns (payment payloads, KYC docs) encrypted at rest using envelope encryption.
- [ ] Enable Neon PITR and schedule weekly restore drill.
- [ ] Back up R2 buckets daily to external S3.
- [ ] Implement data retention policy (see `DATA-MODELS.md`).

---

## 4. Infrastructure Security

- [ ] Cloudflare Zero Trust protects Super Admin dashboard.
- [ ] WAF managed rules + custom rate limits enabled for API routes.
- [ ] Monitor Workers CPU time; alert on anomalies.
- [ ] Rotate API tokens (Cloudflare, Neon, Sparrow SMS) every 90 days.
- [ ] Store secrets in Cloudflare Secrets manager; forbid plaintext `.env` in repo.

---

## 5. Dependency & Supply Chain

- [ ] `pnpm audit` + `npm audit` run weekly; remediate criticals within 48h.
- [ ] Enable Dependabot for npm and GitHub Actions.
- [ ] Verify integrity hashes for third-party scripts (if any) via Subresource Integrity.

---

## 6. Payment Security

- [ ] Follow PCI DSS SAQ-A: only tokenized payments handled client-side.
- [ ] Mask PAN + sensitive data in logs (`****` prefix).
- [ ] Validate webhook signatures from gateways (eSewa, Khalti, etc.).
- [ ] Maintain incident log for disputed transactions.

---

## 7. Monitoring & Response

- [ ] Configure Better Stack alerts for error spikes, auth failures, suspicious IPs.
- [ ] Capture security-relevant metrics (failed logins, password resets, OTP attempts).
- [ ] Integrate PagerDuty or SMS for Sev1 incidents (<=5 min response target).
- [ ] Run quarterly chaos exercise: simulate payment provider outage + evaluate response.

---

## 8. Compliance & Privacy

- [ ] Publish privacy policy + terms in both English/Nepali; version via `policies` table.
- [ ] Honour data subject requests within 30 days; automate anonymization script.
- [ ] Maintain audit trail for consent changes.
- [ ] Ensure log retention policy complies with Nepal regulations (min 1 year for financial records).

---

## 9. Release Checklist

- [ ] Security review sign-off recorded in release ticket.
- [ ] Update changelog with security-impacting changes.
- [ ] Notify merchants of high-severity fixes via dashboard banner/email.
- [ ] Post-release monitoring window: 24h security watch by on-call.

