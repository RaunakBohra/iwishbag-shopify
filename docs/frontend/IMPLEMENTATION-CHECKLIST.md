# 🖥️ Frontend Delivery Checklist

> Tracks the remaining merchant/dashboard/storefront UI work for Sprints 3–4. Pair this with API and onboarding guides for end-to-end delivery.

## 1. Merchant Onboarding Wizard
- [ ] Build step components (`StoreDetails`, `Payments`, `Shipping`, `FirstProduct`, `Theme`, `GoLive`) with form validation.
- [x] Persist progress via onboarding API (`/v1/onboarding/:tenantId`) and resume state on reload.
- [ ] Add analytics instrumentation (PostHog) for step transitions and completion.
- [ ] Surface checklist card on dashboard when onboarding incomplete.
- [ ] Write Playwright flow covering happy path + resume-after-refresh.

## 2. Merchant Dashboard Foundation
- [ ] Implement shell layout (sidebar/topnav) with Clerk/Access-protected routes.
- [ ] Wire RBAC-aware navigation items (hide restricted links).
- [ ] Add analytics placeholders using demo data (orders, revenue, inventory alerts).
- [ ] Integrate notifications center (inventory alerts, onboarding tasks).
- [ ] Snapshot dashboard layout tests (Chromatic/Playwright).

## 3. Catalog Management UI
- [ ] Build product grid with filters, bulk actions, inline status toggle.
- [ ] Implement product detail editor with variant builder + image uploader (R2).
- [ ] Add PostHog events for CRUD actions and variant/image interactions.
- [ ] Ensure API errors surface via toast + form validation states.
- [ ] Cover critical flows with Playwright (create product, add variant, upload media).

## 4. Store Builder & Themes
- [ ] Create theme marketplace page with preview gallery and install flow.
- [ ] Implement drag/drop section editor with live preview (Next.js server actions).
- [ ] Persist theme configuration via API; add undo history.
- [ ] Support bilingual content entry (English/Nepali) with real-time preview.
- [ ] Add unit tests for layout engine + snapshot tests for core themes.

## 5. Storefront UI & Checkout
- [ ] Implement storefront listing/detail pages backed by storefront APIs; add locale toggle.
- [ ] Add responsive design breakpoints (mobile, tablet, desktop) with design tokens.
- [ ] Build cart drawer + checkout flow (anonymous toggle-aware).
- [ ] Integrate low-stock badges and plan-based limits (e.g., variant limits).
- [ ] Add Lighthouse CI config for storefront performance budgets.

## 6. Super Admin Dashboard
- [ ] Build Cloudflare Access-protected admin UI surfacing tenant metrics.
- [ ] Add impersonation flow to jump into merchant dashboard (with audit log).
- [ ] Surface operational alerts (queue depth, failed webhooks) via Better Stack API.
- [ ] Provide CSV export for tenant list and billing overview.
- [ ] Cover critical nav/access with Playwright smoke test.

## 7. Social Commerce Connectors UI
- [ ] Design connector setup wizards for Facebook, Instagram, WhatsApp, TikTok, Viber.
- [ ] Implement OAuth/permission consent screens (stub APIs until integrations ready).
- [ ] Show status cards with last sync, errors, and retry actions.
- [ ] Add PostHog events for connect/disconnect actions.
- [ ] Document connector UX in `docs/features/HYBRID-INTEGRATIONS.md`.

## 8. Marketing Tools UI
- [ ] Create email/SMS campaign builders with template gallery.
- [ ] Implement scheduling UI with timezone selection.
- [ ] Display campaign analytics (open/click/delivery) hooked to PostHog/Better Stack.
- [ ] Add discount/loyalty integration widgets.
- [ ] Add end-to-end tests for campaign creation + schedule flow.

## 9. Observability & QA
- [ ] Establish Playwright suites (desktop/mobile) and baseline artifacts.
- [ ] Hook UI tests into CI with retry + flake quarantine policy.
- [ ] Document developer setup in `docs/guides/FRONTEND-DEVELOPMENT.md` (to author).
- [ ] Add Sentry/Better Stack frontend instrumentation (error boundary + logging).
- [ ] Maintain `NEXT_PUBLIC_*` env var matrix synced with secrets.
