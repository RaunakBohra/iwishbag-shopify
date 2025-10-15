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

### `orders` *(missing)*

- Full order pipeline still to be modelled (see `docs/architecture/API-IMPLEMENTATION-CHECKLIST.md` §4).
- Requirements: order numbers, monetary totals, status enums, relationships to payments, fulfillments, and events.

### `carts` *(in schema)*

- Represents in-progress checkouts with optional customer reference, money totals, TTL (`expires_at`), JSON attributes, and `CartStatus` enum (`ACTIVE`, `CHECKED_OUT`, `ABANDONED`).
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

### `integrations`

**Purpose:** A generic, scalable table to manage all third-party integrations.

```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  management_type VARCHAR(20) DEFAULT 'platform' NOT NULL,
  credentials_encrypted TEXT,
  kms_key_arn TEXT,
  is_verified BOOLEAN DEFAULT false,
  settings JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);
```

### `transactions`

**Purpose:** Payment transaction log with multi-currency support.

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'NPR',
  original_amount DECIMAL(12, 2),
  original_currency VARCHAR(3),
  exchange_rate DECIMAL(12, 6),
  gateway VARCHAR(50) NOT NULL,
  gateway_transaction_id VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `tenant_balances`

**Purpose:** To maintain a real-time balance of how much money the platform owes each tenant.

```sql
CREATE TABLE tenant_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  currency VARCHAR(3) NOT NULL,
  available_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  pending_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, currency)
);
```

### `balance_transactions`

**Purpose:** A detailed, immutable ledger of every single credit and debit for a tenant's balance.

```sql
CREATE TABLE balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  type VARCHAR(50) NOT NULL,
  source_order_id UUID REFERENCES orders(id),
  source_payout_id UUID REFERENCES payouts(id),
  source_refund_id UUID REFERENCES refunds(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `payouts`

**Purpose:** A log of payout requests made to the payment provider.

```sql
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  provider_payout_id VARCHAR(255) UNIQUE,
  destination_method_id UUID REFERENCES tenant_payout_methods(id),
  status VARCHAR(50) NOT NULL DEFAULT 'requested',
  initiated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  failure_reason TEXT
);
```

### `tenant_payout_methods`

**Purpose:** To store the safe tokens representing a tenant's payout destinations.

```sql
CREATE TABLE tenant_payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_method_id VARCHAR(255) NOT NULL,
  display_details TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, provider_method_id)
);
```

### `refunds`

**Purpose:** Order refunds

```sql
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NPR',
  reason VARCHAR(50),
  note TEXT,
  refund_items JSONB NOT NULL,
  restock BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'pending',
  transaction_id UUID REFERENCES transactions(id),
  processed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);
```

### `discounts`

**Purpose:** Discount codes & promotions

```sql
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  minimum_purchase_amount DECIMAL(10,2) DEFAULT 0,
  maximum_discount_amount DECIMAL(10,2),
  usage_limit INT,
  usage_limit_per_customer INT DEFAULT 1,
  usage_count INT DEFAULT 0,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP,
  applies_to VARCHAR(20) DEFAULT 'all',
  applies_to_products UUID[],
  applies_to_collections UUID[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. SHIPPING & LOGISTICS TABLES

### `shipping_zones`

**Purpose:** Shipping regions (Nepal provinces/cities)

```sql
CREATE TABLE shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  provinces VARCHAR(50)[],
  cities VARCHAR(100)[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `shipping_rates`

**Purpose:** Shipping costs per zone

```sql
CREATE TABLE shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_zone_id UUID REFERENCES shipping_zones(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  min_weight DECIMAL(10,2),
  max_weight DECIMAL(10,2),
  min_order_amount DECIMAL(10,2),
  max_order_amount DECIMAL(10,2),
  min_delivery_days INT,
  max_delivery_days INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `fulfillments`

**Purpose:** Order fulfillment tracking

```sql
CREATE TABLE fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  line_items JSONB NOT NULL,
  tracking_company VARCHAR(100),
  tracking_number VARCHAR(255),
  tracking_url TEXT,
  logistics_provider VARCHAR(50),
  location_history JSONB DEFAULT '[]',
  delivered_at TIMESTAMP,
  delivered_to VARCHAR(255),
  delivery_photo_url TEXT,
  delivery_signature_url TEXT,
  failed_reason TEXT,
  failed_attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 8. MARKETING & COMMUNICATIONS TABLES

### `email_templates`

**Purpose:** To store email templates for various transactional emails.

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `sms_templates`

**Purpose:** To store SMS templates for various transactional SMS.

```sql
CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 9. ANALYTICS & REPORTING TABLES

### `page_views`

**Purpose:** To store page view data for analytics.

```sql
CREATE TABLE page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  path VARCHAR(255) NOT NULL,
  referrer VARCHAR(255),
  user_agent VARCHAR(255),
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `events`

**Purpose:** To store custom events for analytics.

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  properties JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

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
