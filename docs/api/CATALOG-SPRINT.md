# 🛒 Catalog & Storefront Sprint Plan (Sprints 3–4)

> Now that the core foundation is live, the next sprints focus on turning the product catalog into a merchant-ready experience and exposing it to storefront customers.

---

## Sprint 3.1 – Catalog Depth
- [x] Extend Prisma schema for variants, option sets, collections, and tags.
- [x] Ship product variant/option/media/tag/collection services with authenticated Hono routes.
- [x] Add R2 asset management (product images upload + ordering).
- [ ] Enforce plan-based product, variant, and image limits.
- [ ] Background job to recompute inventory + search index (MeiliSearch) on changes.
- [x] Unit tests for catalog service edge cases (variants, soft delete, limits).

## Sprint 3.2 – Merchant Catalog UI
- [ ] Build merchant `/catalog` pages (Next.js) with product grid, filters, bulk actions.
- [ ] Product detail/editor with variant builder, image uploader, status toggles.
- [ ] Integrate invite roles/permissions for catalog actions.
- [ ] Hook into PostHog for CRUD events.

## Sprint 3.3 – Storefront API & Pages
- [ ] Public `/v1/storefront/:tenantSlug/products` endpoints (search, pagination, filters).
- [ ] Implement customer-facing product pages in storefront app (Next.js app).
- [ ] Add GSSP caching strategy (Cloudflare) and fallback behaviour.
- [ ] Basic cart abstraction (Durable Object) ready for checkout sprint.

## Sprint 3.4 – Inventory & Logistics Integration
- [ ] Inventory adjustments via webhooks (local couriers, manual adjustments).
- [ ] Low-stock alerts + dashboard widgets.
- [ ] TenantUsage enrichment (variants, images, collections counts).

## Sprint 4 – Onboarding Flow Enhancements
- [ ] Six-step onboarding wizard (store settings, catalog seed, payments, shipping, theme).
- [ ] Localized guidance + plan upsell spots.
- [ ] Post-onboarding checklist tied to analytics.

---

**Testing & Observability**
- [x] Expand Vitest suites with catalog coverage (variants/options/media/collections/tags).
- [ ] Add storefront Vitest coverage and Playwright flows.
- [ ] Add Playwright story for merchant catalog flows (future).
- [ ] Ensure Better Stack monitors cover storefront endpoints.

Use this doc alongside `docs/PROJECT-TODO.md` for granular issue tracking.
