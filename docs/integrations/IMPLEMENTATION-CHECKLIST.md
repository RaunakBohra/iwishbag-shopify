# 🔗 Integrations Implementation Checklist

> Use this tracker to complete Nepal-specific payments/logistics/SMS integrations and supporting infrastructure work.

## 1. Payment Gateways
- [ ] eSewa: finalize merchant onboarding, implement initiate/verify APIs, add webhook handler, document settlement ops.
- [ ] Khalti: integrate checkout API (signature generation + callback URL), handle wallet/QR payments.
- [ ] IME Pay: implement hosted checkout flow, support refund API, map status codes.
- [ ] ConnectIPS: build bank transfer flow with two-step verification, reconcile manual payments.
- [ ] FonePay: add QR code generator, support dynamic QR per order, verify completion webhook.
- [ ] Shared: centralize payment gateway factory, normalize payloads (`payments`, `payment_attempts`), update secrets matrix with provider keys.

## 2. Logistics & Delivery
- [ ] Pathao: implement order creation API, fetch tracking updates, support cancellation.
- [ ] Tootle: integrate pickup scheduling, capture delivery confirmations, ingest webhook status.
- [ ] Nepal Post: define manual handoff flow, create tracking entry and status importer.
- [ ] Shared: build logistics provider abstraction with BYOK credential storage, add monitoring for API failures, expose configuration UI.

## 3. Communication (SMS/Email)
- [ ] Sparrow SMS: finalize sender IDs, implement OTP + marketing endpoints, add delivery status callbacks.
- [ ] SES: move prod account out of sandbox, per-env templates for transactional emails, document DKIM/SPF monitoring.
- [ ] Shared: audit notification pipeline for SMS/email fallbacks, update secrets matrix with tokens.

## 4. Localization & Data
- [ ] Seed Nepal provinces/districts tables with official codes.
- [ ] Add Nepali language content defaults (onboarding copy, storefront strings).
- [ ] Provide translation JSON schema and CLI for content updates.

## 5. Compliance & Ops
- [ ] Document KYC requirements per provider, add onboarding checklist for merchants.
- [ ] Draft incident response playbook for payment/logistics outages (integrate with PagerDuty).
- [ ] Create monitoring dashboard covering payment success rates, delivery SLAs, SMS delivery.

## 6. Deployment & Secrets
- [ ] Ensure provider credentials listed in `docs/secrets/SECRETS-MATRIX.md` and synced to environments.
- [ ] Add integration smoke tests to CI (e.g., stubbed HTTP mocks using MSW).
- [ ] Create rollback procedures for each integration (disable provider, notify merchants).
