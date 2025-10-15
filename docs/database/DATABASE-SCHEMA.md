# 🗄️ COMPLETE DATABASE SCHEMA - NEPAL E-COMMERCE PLATFORM

> **Database:** PostgreSQL 16+ (Neon Serverless)
> **ORM:** Prisma 6
> **Architecture:** Multi-Tenant Shared Database with Row-Level Security
> **Isolation:** `tenant_id` column + PostgreSQL RLS policies

---

## 📋 TABLE OF CONTENTS

1.  [Core System Tables](#1-core-system-tables)
2.  [User & Authentication Tables](#2-user--authentication-tables)
3.  [Merchant & Store Tables](#3-merchant--store-tables)
4.  [Product Catalog Tables](#4-product-catalog-tables)
5.  [Order Management Tables](#5-order-management-tables)
6.  [Payment & Financial Tables](#6-payment--financial-tables)
7.  [Shipping & Logistics Tables](#7-shipping--logistics-tables)
8.  [Marketing & Communications Tables](#8-marketing--communications-tables)
9.  [Analytics & Reporting Tables](#9-analytics--reporting-tables)
10. [Nepal-Specific & Compliance Tables](#10-nepal-specific--compliance-tables)
11. [System Configuration Tables](#11-system-configuration-tables)

---

## 1. CORE SYSTEM TABLES

### `tenants` *(in schema)*

- `id` (`cuid`, primary key)
- `name`, `slug` (unique), `plan`, `plan_status`, `trial_ends_at`
- Relations: `subscription` (`TenantSubscription?`), `usage` (`TenantUsage?`), `users`, `roles`, `products`, `collections`, `tags`, `inventory`, `inventoryAdjustments`, `invitees`, `auditLogs`
- Timestamps: `created_at`, `updated_at`

**Gaps vs blueprint**
- Contact & compliance metadata captured (`email`, `phone`, `business_name`, `PAN`, `VAT`, KYC timestamps).
- Plan limits exist as nullable columns; still need enforcement logic + migration path from `PlanTier` enum to `subscription_plans`.
- JSON `settings` encapsulated via `tenant_settings` relation; evaluate schema validation + auditing.
- Soft delete column (`deleted_at`) present; add default scope in Prisma client/helpers.
- RLS policy pending (see Section 2).

**Indexes / constraints**
- `slug` unique (✅).
- Add composite unique on `(id, slug)` not required.
- Consider partial index on active tenants post soft-delete.

### `subscription_plans` *(in schema)*

- Fields: `id`, `name`, `slug` (unique), optional `description`.
- Pricing: `price_monthly`, `price_yearly` (decimal, default 0).
- Limits: `max_products`, `max_orders_per_month`, `max_staff`, `max_storage_gb`, `max_email_per_month`, `max_sms_per_month`.
- Metadata: JSON `features`, `is_active`, `display_order`, timestamps.
- Relation: `tenants` back-reference via optional `tenant.planId`.

**Follow-ups**
- Seed default Free/Pro/Max plans and map existing tenant enum usage.
- Evaluate migrating away from enum `PlanTier` once foreign key in use.

---

## 2. USER & AUTHENTICATION TABLES

### `users` *(in schema)*

- Fields: `id`, `tenant_id` (nullable), `email` (unique), `password_hash`, personal details, `role`, audit timestamps, `deleted_at`.
- Relations: `tenant`, `invite`, `invitedUsers`, `roleAssignments`, `auditLogs`.

**Gaps**
- Missing phone, username, language/timezone defaults, 2FA columns, status enum, verification timestamps, metadata JSON.
- Requires composite unique index `(tenant_id, email)` when tenant scoped.
- Soft delete column present (`deleted_at`), but Prisma filters/tests needed.

**Indexes / constraints**
- Add `@@index([tenantId])` for lookups (optional).
- Implement unique constraint or partial unique per tenant.

---

## 3. MERCHANT & STORE TABLES

### `themes` *(in schema)*

- Platform-level catalog of themes with `name`, `slug`, optional `description`.
- JSON `config` placeholder for default layout settings.
- Flags: `is_default`, `is_active`; timestamps maintained automatically.
- Relation: `stores` referencing active theme assignments.

**Follow-ups**
- Define config schema (JSON Schema) and validation hook.
- Seed curated starter themes with preview metadata.

### `stores` *(in schema)*

- One-to-one relationship with `tenants` (`tenant_id` unique).
- Fields: `id`, `name`, `slug` (unique), optional `description`.
- Branding: `logo_url`, `favicon_url`, `primary_color`, `secondary_color`.
- Optional `theme_id` referencing `themes`, JSON `settings` for customised overrides.
- Tracks `created_at`, `updated_at`.

**Follow-ups**
- Enforce single primary store per tenant in business logic.
- Add bilingual copy fields and locale toggles per design spec.

### `store_domains` *(in schema)*

- Fields: `id`, `store_id`, `hostname` (globally unique), `is_primary`, `verified_at`, timestamps.
- Ensures each domain belongs to a single store; primary flag to be validated in app logic.

**Follow-ups**
- Add partial unique or constraint to guarantee a single `is_primary = true` per store.
- Store DNS verification metadata (TXT token, status history).

### `staff_members` *(missing)*

- Still evaluating dedicated table vs. deriving from users/role assignments; no Prisma model yet.

### `permissions` / `roles` / `role_permissions` / `staff_roles`

- `roles`, `permissions`, `RolePermission`, and `UserRoleAssignment` exist.
- Missing taxonomy (`category`), seeding of default permissions/roles, and optional `staff_members` join layer.

### `menus` *(in schema)*

- Tenant-scoped navigation container with `name`, `handle`, optional `location`, and `position` for ordering.
- `@@unique([tenant_id, handle])` ensures one handle per tenant; indexed by `(tenant_id, position)` for quick fetch.
- Relation to `menu_items` with cascading deletes handled at Prisma level.

**Follow-ups**
- Audit allowed `location` values (primary, footer, etc.) and consider enum.
- Add revision history or published flag if needed for preview workflows.

### `menu_items` *(in schema)*

- Supports tree structure via self-referencing relation (`parent_id`) with Cascade on delete.
- Bilingual titles (`title_en`, `title_ne`), optional URL/target metadata, `position`, and visibility flag.

**Follow-ups**
- Validate `url` vs. `target_id` exclusivity at application layer.
- Consider `link_type` enum to distinguish between internal/external resources.

### `pages` *(in schema)*

- Tenant-owned CMS pages with bilingual titles, slug (unique per tenant), `PageStatus` enum, metadata, `published_at`, and soft delete.
- Indexed on `(tenant_id, status)` for filtering drafts vs. published pages.

**Follow-ups**
- Implement partial index on published pages once migrations begin.
- Add content versioning / revision table if editorial workflow requires it.

### `page_blocks` *(in schema)*

- Child blocks tied to a page, storing `block_type`, JSON content payload, and ordered by `position`.
- Cascade delete when parent page is removed.

**Follow-ups**
- Define schema per `block_type` (hero, rich_text, gallery) and enforce via validation.
- Add auditing columns (created_by) if multiple editors collaborate.

---

## 4. PRODUCT CATALOG TABLES

### `products`

**Purpose:** Core product information

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  -- ... other product fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);
```

---

## 5. ORDER MANAGEMENT TABLES

### `customers` *(in schema)*

- Tenant-scoped record with optional email/phone, profile fields, locale, status, tags, and soft delete tracking.
- Relations: `customer_addresses`, `carts`, and `orders`.
- `@@unique([tenant_id, email])` prevents duplicate accounts per tenant/email combination while allowing multiple `NULL` entries.
- JSON `attributes` reserved for metafields (loyalty IDs, preferences, etc.).

**Follow-ups**
- Evaluate hashing/anonymisation strategy for PII (per compliance checklist).
- Emit audit logs on creation/update/deletion.

### `customer_addresses` *(in schema)*

- Linked to both tenant and customer; captures address lines, province/district, default billing/shipping flags, and metadata.
- Indexed on `(tenant_id, customer_id)` to accelerate address listings.

**Follow-ups**
- Normalise provinces/districts once lookup tables are seeded.
- Enforce single default billing/shipping address via application logic.

### `orders` *(in schema)*

- Tenant-scoped orders with sequential `order_number` (unique per tenant), optional `customer_id` and `cart_id`, and `OrderStatus` enum (`DRAFT`, `PENDING`, `CONFIRMED`, `PARTIALLY_FULFILLED`, `FULFILLED`, `CANCELLED`, `RETURNED`).
- Money columns (`subtotal`, `discount_total`, `shipping_total`, `tax_total`, `total`) stored as decimals alongside `currency`.
- Snapshot JSON for `billing_address` and `shipping_address`, optional `note`, `metadata`, and timestamps (`placed_at`, `created_at`, `updated_at`).
- Relations to line items, taxes, shipping lines, events, and (in later phases) payments/fulfillments.

**Follow-ups**
- Generate order numbers per tenant (prefix + sequential counter).
- Enforce derived totals via service-layer helpers or database triggers.
- Capture audit info (`created_by`) once admin UI is available.

### `order_items` *(in schema)*

- Each item links to optional `product`/`product_variant` snapshot plus canonical `title`, `sku`, `quantity`, unit/subtotal/discount/tax amounts, and metadata.
- Indexed by `order_id`; cascade deletes when parent order removed.

**Follow-ups**
- Persist price currency if multi-currency carts allowed.
- Add JSON for applied discounts/promotion codes per item.

### `order_tax_lines` *(in schema)*

- Stores per-order tax breakdown with `title`, `rate`, `amount`, metadata, and timestamps.
- Indexed by `order_id`.

**Follow-ups**
- Expand to capture jurisdiction codes once tax tables are seeded.
- Enforce positive amounts and rate range validation.

### `order_shipping_lines` *(in schema)*

- Represents shipping charges by carrier/service, amounts, taxes, tracking metadata, and estimated arrival.
- Indexed by `order_id` for quick retrieval.

**Follow-ups**
- Add constraint ensuring a single primary shipping line, or move to separate fulfillment stage.
- Track packaging weight/dimensions for analytics.

### `order_events` *(in schema)*

- Append-only event log capturing lifecycle transitions (`type`, `message`, optional structured `data`, `created_by`).
- Indexed by `order_id`.

**Follow-ups**
- Replace free-form `type` string with enum once workflow stabilises.
- Emit webhook/job triggers on key events (placed, cancelled, fulfilled).

### `carts` *(in schema)*

- Represents in-progress checkouts with optional customer reference, money totals, TTL (`expires_at`), JSON attributes, and `CartStatus` enum (`ACTIVE`, `CHECKED_OUT`, `ABANDONED`).
- Linked one-to-one with `orders` via optional `order_id` (unique) so historical carts can be inspected post-checkout.
- Indexed by `(tenant_id, status)` and `(tenant_id, customer_id)` for dashboard + customer views.

**Follow-ups**
- Background job to mark expired carts as `ABANDONED`.
- Capture source channel (e.g., web, POS) if needed for analytics.

### `cart_items` *(in schema)*

- Items reference `products` and optional `product_variants`, storing quantity, price, subtotal, and arbitrary attributes.
- Cascade delete when cart removed; indexed by `cart_id`.

**Follow-ups**
- Add uniqueness constraint `(cart_id, product_id, variant_id)` to prevent duplicates.
- Track tax/discount breakdown at line-item level for compliance exports.

---

## 6. PAYMENT & FINANCIAL TABLES

### `payments` *(in schema)*

- Captures tenant/order payment records with provider identifiers, method, status enum (`PaymentStatus`), multi-currency support, captured/refunded totals, and metadata.
- Unique `(tenant_id, provider, provider_payment_id)` prevents duplicate ingestion; indexed by `order_id`.
- Relations: payment attempts, refunds (cascade on order delete).

**Follow-ups**
- Encrypt sensitive provider payloads and add audit timestamps (`authorized_at`, `captured_at`).
- Wire to reconciliation job to validate captured vs. order totals.

### `payment_attempts` *(in schema)*

- Logs gateway retries with status, error codes/messages, metadata, and timestamp.
- Cascade delete ensures no orphan attempts when a payment is removed.

**Follow-ups**
- Persist hashed request/response payloads for forensic analysis.
- Add monitoring-friendly index on `(status)` to detect repeated failures.

### `refunds` *(in schema)*

- Stores refunds tied to payments (and optionally orders) with amount, reason, status, and metadata.
- Indexed by `tenant_id` and `payment_id`; cascades when payment is deleted.

**Follow-ups**
- Promote `status` to enum and capture provider refund IDs.
- Track item-level refund breakdown once returns workflow is modelled.

### Remaining financial tables *(not yet modelled)*

- `transactions`, `tenant_balances`, `balance_transactions`, `payouts`, payout methods, and integration credentials remain as blueprint tasks and will be introduced in later phases alongside ledger/reconciliation work.

### `discounts` *(in schema)*

- Stores merchant discount campaigns with optional coupon `code`, discount `type` (`PERCENTAGE`, `FIXED_AMOUNT`, `FREE_SHIPPING`), allocation scope (order vs product), value, spend thresholds, timeframe, usage limits, stackability, and metadata.
- Relations: rules, conditions, and usages; indexed by `(tenant_id, status)` and unique per tenant/code.

**Follow-ups**
- Enforce max redemptions per customer/order in service layer.
- Add analytics on redemption performance once usage events instrumented.

### `discount_rules` *(in schema)*

- Captures rule modifiers per discount (e.g., applies once per order, additional metadata for future rule types).
- Cascade deletes with parent discount and indexed by `discount_id`.

**Follow-ups**
- Extend structure to capture minimum item counts or tiered discounts.

### `discount_conditions` *(in schema)*

- Represents polymorphic conditions (collections, products, customer segments) via `type`, optional operator, and JSON values array.
- Indexed by `discount_id` for quick evaluation.

**Follow-ups**
- Replace free-form `type`/`operator` with enums when condition taxonomy stabilises.
- Validate referenced IDs exist before activation.

### `discount_usages` *(in schema)*

- Logs each redemption with optional `customer_id`, `order_id`, and metadata; timestamps default to `used_at`.
- Indexed by discount, customer, and order for reporting.

**Follow-ups**
- Prevent multiple redemptions per order when `appliesOnce` is false via unique constraints/logic.

### `gift_cards` *(in schema)*

- Tenant gift cards with unique `code`, balances, currency, optional customer owner, expiry, metadata, and active flag.
- Relations: transactions; balances updated atomically in service layer.

**Follow-ups**
- Hash codes in storage or encrypt when compliance requires.
- Add issuance/revocation audit logging.

### `gift_card_transactions` *(in schema)*

- Ledger of gift card changes (issue, redeem, refund) capturing order references, amount deltas, resulting balance, and metadata.
- Indexed by `gift_card_id`.

**Follow-ups**
- Formalise `type` as enum and include actor identifiers.

### `tax_rates` *(in schema)*

- Stores tenant tax definitions with rate, scope (country/province/district), default flag, and metadata; indexed by `(tenant_id, is_default)`.
- Relations: `tax_overrides` to attach rate to specific resources.

**Follow-ups**
- Prevent more than one default per tenant via SQL constraint.
- Seed Nepal 13% VAT default via seeds.

### `tax_overrides` *(in schema)*

- Overrides linking a `tax_rate` to a specific resource level (product, collection, shipping profile) via `level` and `reference_id` fields.
- Indexed by tenant and rate for efficient lookups.

**Follow-ups**
- Enforce referential integrity once reference tables (collections, profiles) are modelled.
- Consider composite uniqueness `(tenant_id, level, reference_id)`.

---

## 7. SHIPPING & LOGISTICS TABLES

### `shipping_profiles` *(in schema)*

- Tenant-level grouping of fulfilment strategies (e.g., general store vs. heavy goods) with optional metadata and default flag.
- Relation: `shipping_zones`; unique per tenant name and indexed on `(tenant_id, is_default)`.

**Follow-ups**
- Enforce single default per tenant via migration.
- Add link to product/collection assignments once modelling for shipping requirements is complete.

### `shipping_zones` *(in schema)*

- Belongs to a `shipping_profile`; captures named regions with configurable province/district lists, metadata, and active flag.
- Indexed on `(tenant_id, is_active)`; cascades on profile deletion.

**Follow-ups**
- Replace free-form JSON with structured province/district references when lookup tables are seeded.

### `shipping_rates` *(in schema)*

- Holds per-zone pricing rules with rate type (`FLAT`, `WEIGHT`, `PRICE`), amount, min/max weight and subtotal thresholds, delivery window hints, and active flag.
- Indexed on `(tenant_id, is_active)` for quick dashboard filtering.

**Follow-ups**
- Validate thresholds (min <= max) in application logic.
- Attach currency overrides if multi-currency shipping arrives.

### `shipping_providers` *(in schema)*

- Stores third-party logistics integrations (Pathao, Tootle, Nepal Post) with slug, credential payload, activation state, and metadata.
- Unique per tenant/slug combination; relation to `shipments` for auditability.

**Follow-ups**
- Encrypt `credentials` at rest.
- Add webhooks configuration fields when provider integrations are fleshed out.

### `shipments` *(in schema)*

- Individual shipment records linked to orders (and optional fulfillments/providers) containing tracking details, status, timestamps, and metadata.
- Indexed on `(tenant_id, status)` and `order_id` for fulfilment dashboards.

**Follow-ups**
- Normalize `status` into enum once workflow states are finalised.
- Persist carrier events to trigger `fulfillment_events` or customer notifications.

### `fulfillments` *(in schema)*

- Tracks execution of shipments per order, storing `FulfillmentStatus`, tracking metadata, shipped/delivered timestamps, and arbitrary metadata.
- Relations: `fulfillment_items`, `fulfillment_events`, new `shipments`; indexed by `order_id`.

**Follow-ups**
- Add warehouse/source fields and carrier service codes when multi-warehouse support lands.
- Capture who fulfilled the order (user IDs) for audit purposes.

### `fulfillment_items` *(in schema)*

- Links fulfillments to individual `order_items`, recording quantities and metadata.
- Cascade deletes with parent fulfillment; indexed by `fulfillment_id`.

**Follow-ups**
- Enforce quantity constraints (cannot exceed ordered quantity).
- Include per-item status (picked, packed, backordered) if workflows require.

### `fulfillment_events` *(in schema)*

- Event log for fulfillment lifecycle (picked, handed to carrier, delivered, failed) with optional structured data and actor (`created_by`).
- Indexed by `fulfillment_id`.

**Follow-ups**
- Hook events into notification/webhook system.
- Deduplicate repeated carrier callbacks with idempotency keys.

---

## 8. MARKETING & COMMUNICATIONS TABLES

### `email_templates` *(in schema)*

- Stores reusable email content blocks with subject/body payload (JSON to support localisation), category tagging, activation flag, and metadata.
- Unique per tenant/name to avoid duplicates.

**Follow-ups**
- Add versioning/audit trail for template edits.
- Support multi-language body payloads.

### `sms_templates` *(in schema)*

- Similar to email templates but optimised for SMS body text; includes category, active flag, and metadata.
- Unique per tenant/name.

**Follow-ups**
- Enforce message length/encoding constraints before dispatch.

## 9. ANALYTICS & REPORTING TABLES

### `page_views` *(in schema)*

- Captures frontend analytics (path, referrer, UA, IP, optional session metadata) with timestamp for trend analysis.
- Indexed by `(tenant_id, occurred_at)` for time-series queries.

**Follow-ups**
- Integrate GeoIP enrichment downstream if needed.

### `analytics_events` *(in schema)*

- Generic event telemetry with JSON properties, optional customer linkage, and occurrence timestamp.
- Indexed by tenant/time and customer for funnels and segmentation.

**Follow-ups**
- Enforce event name taxonomy via enum/lookup table once analytics roadmap is finalised.

### `loyalty_programs` *(in schema)*

- Defines tenant loyalty schemes, configuration JSON, activation flag, and metadata; relations to transactions/referrals.

**Follow-ups**
- Model plan tiers/reward rules explicitly once business rules stabilise.

### `loyalty_transactions` *(in schema)*

- Ledger of points awarded/deducted per program and customer, tracking running balance and metadata.

**Follow-ups**
- Add double-entry validation if programs require more rigorous accounting.

### `referrals` *(in schema)*

- Links referrers to referred customers/emails, with optional loyalty program association, status tracking, and metadata.

**Follow-ups**
- Add unique constraint preventing duplicate active referrals for same email.
- Store incentive payout references once implemented.

---

## 10. NEPAL-SPECIFIC & COMPLIANCE TABLES

### `provinces`

**Purpose:** To store the provinces of Nepal.

```sql
CREATE TABLE provinces (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  name_nepali VARCHAR(100) NOT NULL
);
```

### `districts`

**Purpose:** To store the districts of Nepal.

```sql
CREATE TABLE districts (
  id INT PRIMARY KEY,
  province_id INT REFERENCES provinces(id),
  name VARCHAR(50) NOT NULL,
  name_nepali VARCHAR(100) NOT NULL
);
```

### `kyc_documents`

**Purpose:** To store KYC documents for merchants.

```sql
CREATE TABLE kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  document_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 11. SYSTEM CONFIGURATION TABLES

### `settings`

**Purpose:** To store system-wide settings.

```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## KEY ARCHITECTURAL NOTES

**Multi-Tenancy Implementation:**
- All tenant-scoped tables have `tenant_id UUID` column
- PostgreSQL Row-Level Security (RLS) enforces tenant isolation
- Composite indexes on `(tenant_id, ...)` for optimal query performance
- Single database serves all tenants (simpler, cheaper, industry-standard).

See [NEON-MULTI-TENANT.md](./NEON-MULTI-TENANT.md) for implementation details.
