# 📦 Data Models

> **Version:** 1.0
> **Status:** In Progress

This guide maps business capabilities to database entities and breaks the modelling work into atomic steps. Use it alongside `DATABASE-SCHEMA.md`.

---

## 0. Delivery Checklist

- [ ] Confirm every table listed below exists in the Prisma schema with naming parity.
- [ ] Ensure every tenant-scoped table includes `tenant_id` and RLS policy.
- [ ] Create composite indexes identified in each section.
- [ ] Add Prisma-level `@@map` annotations where snake_case ⇆ camelCase differs.
- [ ] Document seed data requirements (plans, permissions, provinces, districts).

---

## 1. Core Platform

| Capability | Tables | Atomic Tasks |
|------------|--------|--------------|
| Tenant provisioning | `tenants`, `subscription_plans`, `tenant_settings` | [ ] Implement RLS for tenants. [ ] Seed default plans (Free, Pro, Max). [ ] Add trigger to update `updated_at`. |
| User directory | `users`, `user_roles`, `role_permissions`, `permissions` | [ ] Seed base roles/permissions. [ ] Create unique composite index on `(tenant_id, email)`. [ ] Add soft-delete column (`deleted_at`) constraints. |
| Audit trail | `audit_logs` | [ ] Define enum for event types. [ ] Partition table monthly. [ ] Index on `(tenant_id, created_at DESC)`. |

---

## 2. Merchant Storefront

| Capability | Tables | Atomic Tasks |
|------------|--------|--------------|
| Store settings | `stores`, `domains`, `themes` | [ ] Enforce 1:1 between `tenants` and `stores`. [ ] Validate custom domain uniqueness. [ ] Store theme config as JSONB with schema validation. |
| Navigation | `menus`, `menu_items` | [ ] Implement ordering column for drag-and-drop. [ ] Add `ON DELETE CASCADE` from menu → items. |
| Content pages | `pages`, `page_blocks` | [ ] Support bilingual content columns (`title_en`, `title_ne`, etc.). [ ] Create partial index for published pages. |

---

## 3. Catalog & Inventory

| Capability | Tables | Atomic Tasks |
|------------|--------|--------------|
| Products & variants | `products`, `product_variants`, `product_options`, `product_option_values` | [ ] Ensure `sku` unique per tenant. [ ] Add generated column `search_vector` (tsvector). [ ] Establish cascading deletes for variants/options. |
| Media | `product_images`, `files` | [ ] Store R2 object key + metadata. [ ] Add `position` ordering. |
| Collections | `collections`, `collection_products` | [ ] Add unique constraint `(collection_id, product_id)`. [ ] Implement soft delete on collections. |
| Inventory | `inventory_levels`, `inventory_adjustments`, `warehouses` | [ ] Allow future multi-warehouse by keeping `warehouse_id` optional. [ ] Add check constraint `quantity >= 0`. |

---

## 4. Orders & Customers

| Capability | Tables | Atomic Tasks |
|------------|--------|--------------|
| Customers | `customers`, `customer_addresses`, `customer_tags` | [ ] Hash PII sensitive fields where applicable. [ ] Add unique composite `(tenant_id, email)` with NULL allowed. |
| Carts | `carts`, `cart_items` | [ ] `expires_at` column with TTL cleanup job. [ ] Add JSONB `attributes` column for metafields. |
| Orders | `orders`, `order_items`, `order_shipping_lines`, `order_taxes`, `order_events`, `order_fulfillments` | [ ] Use enum `order_status`. [ ] Populate `subtotal`, `total`, `tax_total` via database trigger for integrity. [ ] Index `orders(tenant_id, created_at DESC)`. |
| Payments | `payments`, `payment_attempts`, `refunds` | [ ] Store provider payload encrypted. [ ] Add unique constraint `provider_id` to avoid duplicates. |
| Fulfillment | `fulfillments`, `fulfillment_items`, `fulfillment_events` | [ ] Track `tracking_company`, `tracking_number` unique for active fulfillments. |

---

## 5. Pricing & Promotions

| Capability | Tables | Atomic Tasks |
|------------|--------|--------------|
| Discounts | `discounts`, `discount_rules`, `discount_conditions`, `discount_usages` | [ ] Model polymorphic conditions (collections, products, customer tags). [ ] Create partial index for active discounts (`starts_at`/`ends_at`). |
| Gift cards | `gift_cards`, `gift_card_transactions` | [ ] Generate codes via trigger. [ ] Enforce positive balance. |
| Taxes | `tax_rates`, `tax_overrides` | [ ] Seed Nepal 13% VAT default. [ ] Link overrides to provinces/districts. |

---

## 6. Logistics & Delivery

| Capability | Tables | Atomic Tasks |
|------------|--------|--------------|
| Shipping | `shipping_profiles`, `shipping_zones`, `shipping_rates` | [ ] Denormalize Nepal provinces/districts for faster lookup. [ ] Add `min_cart_total` and `max_cart_total` constraints. |
| Carrier integrations | `shipping_providers`, `shipping_provider_credentials`, `shipments` | [ ] Support BYOK using encrypted credentials blob. [ ] Track webhook callback URLs per provider. |
| Warehouse ops | `pick_lists`, `packing_slips` | [ ] Generate sequential document numbers per tenant. |

---

## 7. Marketing & Communication

| Capability | Tables | Atomic Tasks |
|------------|--------|--------------|
| Email | `email_templates`, `email_campaigns`, `email_logs` | [ ] Store SES message ID. [ ] Add job reference to queue table. |
| SMS | `sms_templates`, `sms_logs` | [ ] Capture delivery status callbacks. |
| Analytics | `page_views`, `events`, `funnel_snapshots` | [ ] Partition `page_views` by month. [ ] Add materialized view for dashboard analytics. |
| Loyalty | `loyalty_programs`, `loyalty_transactions`, `referrals` | [ ] Keep ledger-style double entry for loyalty points. |

---

## 8. Compliance & Localization

| Capability | Tables | Atomic Tasks |
|------------|--------|--------------|
| KYC | `kyc_documents`, `kyc_review_logs` | [ ] Store file references in R2 with status transitions. [ ] Enforce reviewer foreign key to `users` with platform admin role. |
| Legal | `consents`, `policies`, `policy_versions` | [ ] Record timestamp + IP for consent. |
| Localization | `provinces`, `districts`, `translations` | [ ] Seed official Nepal province/district data. [ ] Add unique composite on `(tenant_id, namespace, key)` for translations. |

---

## 9. System Configuration

| Capability | Tables | Atomic Tasks |
|------------|--------|--------------|
| Feature Flags | `feature_flags`, `tenant_feature_flags` | [ ] Store rollout strategy JSON (percentage, segment). |
| Settings | `settings`, `tenant_settings` | [ ] Define schema validation per key. |
| Background jobs | `queue_jobs`, `queue_failures` | [ ] Retain history 30 days; add index for `status` + `run_at`.

---

## 10. Data Lifecycle Management

- [ ] Define retention policy per table (e.g., carts 30 days, logs 180 days).
- [ ] Implement deletion cascade tests in CI using Prisma + Vitest.
- [ ] Document anonymization routine for user deletion requests.
- [ ] Schedule quarterly schema reviews to align with product roadmap.

