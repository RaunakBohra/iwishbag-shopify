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

### `tenants`

**Purpose:** Multi-tenant isolation - each merchant is a tenant

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  business_name VARCHAR(255),
  business_type VARCHAR(50),
  pan_number VARCHAR(20),
  vat_number VARCHAR(20),
  registration_number VARCHAR(50),
  plan_id UUID REFERENCES subscription_plans(id),
  plan_status VARCHAR(20) DEFAULT 'trial',
  trial_ends_at TIMESTAMP,
  subscription_starts_at TIMESTAMP,
  subscription_ends_at TIMESTAMP,
  payment_provider_account_id VARCHAR(255) UNIQUE,
  max_products INT DEFAULT 25,
  max_orders_per_month INT DEFAULT 50,
  max_staff INT DEFAULT 1,
  max_storage_gb INT DEFAULT 1,
  timezone VARCHAR(50) DEFAULT 'Asia/Kathmandu',
  currency VARCHAR(3) DEFAULT 'NPR',
  language VARCHAR(5) DEFAULT 'ne',
  date_format VARCHAR(20) DEFAULT 'YYYY/MM/DD',
  status VARCHAR(20) DEFAULT 'pending',
  kyc_status VARCHAR(20) DEFAULT 'pending',
  kyc_submitted_at TIMESTAMP,
  kyc_approved_at TIMESTAMP,
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

### `subscription_plans`

**Purpose:** Platform pricing tiers (Free, Pro, Max)

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) DEFAULT 0,
  price_yearly DECIMAL(10,2) DEFAULT 0,
  max_products INT DEFAULT -1,
  max_orders_per_month INT DEFAULT -1,
  max_staff INT DEFAULT 1,
  max_storage_gb INT DEFAULT 1,
  max_email_per_month INT DEFAULT 0,
  max_sms_per_month INT DEFAULT 0,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 2. USER & AUTHENTICATION TABLES

### `users`

**Purpose:** All users (merchants, customers, staff, admins)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  username VARCHAR(50) UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  password_hash VARCHAR(255),
  email_verified_at TIMESTAMP,
  phone_verified_at TIMESTAMP,
  role VARCHAR(20) NOT NULL,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  last_login_at TIMESTAMP,
  last_login_ip VARCHAR(45),
  language VARCHAR(5) DEFAULT 'ne',
  timezone VARCHAR(50) DEFAULT 'Asia/Kathmandu',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

---

## 3. MERCHANT & STORE TABLES

### `stores`

**Purpose:** E-commerce store configuration

```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  -- ... and other store settings
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `staff_members`

**Purpose:** Store staff member information.

```sql
CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active',
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);
```

### `permissions`

**Purpose:** Defines all possible granular actions within the system.

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'products:create', 'orders:fulfill'
  description TEXT,
  category VARCHAR(50) NOT NULL -- e.g., 'Products', 'Orders'
);
```

### `roles`

**Purpose:** A collection of permissions that can be assigned to staff members.

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);
```

### `role_permissions`

**Purpose:** Links roles with their granted permissions.

```sql
CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
```

### `staff_roles`

**Purpose:** Assigns roles to staff members.

```sql
CREATE TABLE staff_roles (
  staff_id UUID REFERENCES staff_members(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, role_id)
);
```

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

### `customers`

**Purpose:** Store customers

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255),
  phone VARCHAR(20),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  -- ... other customer fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);
```

### `orders`

**Purpose:** Customer orders

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  total DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NPR',
  payment_status VARCHAR(20) DEFAULT 'pending',
  fulfillment_status VARCHAR(20) DEFAULT 'unfulfilled',
  -- ... other order fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

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
