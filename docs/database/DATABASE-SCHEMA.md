# 🗄️ COMPLETE DATABASE SCHEMA - NEPAL E-COMMERCE PLATFORM

> **Database:** PostgreSQL 16+ (Neon Serverless)
> **ORM:** Prisma 6
> **Architecture:** Multi-Tenant Shared Database with Row-Level Security
> **Isolation:** tenant_id column + PostgreSQL RLS policies
> **Total Tables:** 65+
> **Recommended for:** 0-100k daily users, 1000+ tenants

---

## 📋 TABLE OF CONTENTS

1. [Core System Tables](#1-core-system-tables)
2. [User & Authentication Tables](#2-user--authentication-tables)
3. [Merchant & Store Tables](#3-merchant--store-tables)
4. [Product Catalog Tables](#4-product-catalog-tables)
5. [Order Management Tables](#5-order-management-tables)
6. [Payment & Financial Tables](#6-payment--financial-tables)
7. [Shipping & Logistics Tables](#7-shipping--logistics-tables)
8. [Marketing & Communications Tables](#8-marketing--communications-tables)
9. [Analytics & Reporting Tables](#9-analytics--reporting-tables)
10. [Nepal-Specific Tables](#10-nepal-specific-tables)
11. [System Configuration Tables](#11-system-configuration-tables)

---

## 1. CORE SYSTEM TABLES

### `tenants`
**Purpose:** Multi-tenant isolation - each merchant is a tenant
```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identity
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL, -- yourstore.nepshop.com
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),

  -- Business Info
  business_name VARCHAR(255),
  business_type VARCHAR(50), -- sole_proprietor, pvt_ltd, partnership
  pan_number VARCHAR(20),
  vat_number VARCHAR(20),
  registration_number VARCHAR(50), -- Nepal company registration

  -- Subscription
  plan_id UUID REFERENCES subscription_plans(id),
  plan_status VARCHAR(20) DEFAULT 'trial', -- trial, active, past_due, canceled
  trial_ends_at TIMESTAMP,
  subscription_starts_at TIMESTAMP,
  subscription_ends_at TIMESTAMP,

  -- Payment Provider Account ID (e.g., from Airwallex or Stripe Connect)
  payment_provider_account_id VARCHAR(255) UNIQUE,

  -- Limits (based on plan)
  max_products INT DEFAULT 25,
  max_orders_per_month INT DEFAULT 50,
  max_staff INT DEFAULT 1,
  max_storage_gb INT DEFAULT 1,

  -- Settings
  timezone VARCHAR(50) DEFAULT 'Asia/Kathmandu',
  currency VARCHAR(3) DEFAULT 'NPR',
  language VARCHAR(5) DEFAULT 'ne', -- ne, en
  date_format VARCHAR(20) DEFAULT 'YYYY/MM/DD',

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, suspended, deleted
  kyc_status VARCHAR(20) DEFAULT 'pending', -- pending, submitted, approved, rejected
  kyc_submitted_at TIMESTAMP,
  kyc_approved_at TIMESTAMP,

  -- Metadata
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_plan_id ON tenants(plan_id);
CREATE INDEX idx_tenants_payment_provider_account_id ON tenants(payment_provider_account_id);
```

### `subscription_plans`
**Purpose:** Platform pricing tiers (Free, Pro, Max)
```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plan Info
  name VARCHAR(50) NOT NULL, -- Free, Pro, Max
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,

  -- Pricing
  price_monthly DECIMAL(10,2) DEFAULT 0, -- NPR
  price_yearly DECIMAL(10,2) DEFAULT 0, -- NPR (with discount)

  -- Limits
  max_products INT DEFAULT -1, -- -1 = unlimited
  max_orders_per_month INT DEFAULT -1,
  max_staff INT DEFAULT 1,
  max_storage_gb INT DEFAULT 1,
  max_email_per_month INT DEFAULT 0,
  max_sms_per_month INT DEFAULT 0,

  -- Features (JSONB for flexibility)
  features JSONB DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 2. USER & AUTHENTICATION TABLES

---

## 3. MERCHANT & STORE TABLES

---

## 4. PRODUCT CATALOG TABLES

---

## 5. ORDER MANAGEMENT TABLES

---

## 6. PAYMENT & FINANCIAL TABLES

### `integrations`
**Purpose:** A generic, scalable table to manage all third-party integrations (Payments, Shipping, Analytics, etc.) using the BYOK model.
```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- The unique identifier for the plugin, e.g., 'esewa', 'pathao', 'google_analytics'
  provider VARCHAR(50) NOT NULL,
  -- The category of the integration for easier management
  category VARCHAR(50) NOT NULL, -- 'payment', 'shipping', 'analytics', 'communication'

  -- Is this specific integration active for the tenant?
  is_active BOOLEAN DEFAULT false,

  -- Hybrid Model Management
  management_type VARCHAR(20) DEFAULT 'platform' NOT NULL, -- 'platform' or 'merchant' (for BYOK)

  -- Merchant-Managed (BYOK) Fields
  credentials_encrypted TEXT,
  kms_key_arn TEXT,
  is_verified BOOLEAN DEFAULT false,

  -- A flexible field for any other provider-specific settings
  settings JSONB,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, provider)
);

CREATE INDEX idx_integrations_tenant_id_provider ON integrations(tenant_id, provider);
```

### `transactions`
**Purpose:** Payment transaction log with multi-currency support.
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,

  -- The amount in the tenant's base currency (e.g., NPR) for their ledger.
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'NPR',

  -- The original amount and currency of the customer's payment (e.g., USD).
  original_amount DECIMAL(12, 2),
  original_currency VARCHAR(3),
  -- The exchange rate used at the time of transaction to convert original_amount to amount.
  exchange_rate DECIMAL(12, 6),

  -- Transaction Info
  gateway VARCHAR(50) NOT NULL, -- e.g., 'airwallex', 'esewa'
  gateway_transaction_id VARCHAR(255) UNIQUE NOT NULL,
  
  type VARCHAR(20) NOT NULL, -- 'payment', 'refund'
  status VARCHAR(20) NOT NULL, -- 'pending', 'success', 'failed'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_tenant_id ON transactions(tenant_id);
CREATE INDEX idx_transactions_order_id ON transactions(order_id);
CREATE INDEX idx_transactions_status ON transactions(status);
```

### `tenant_balances`
**Purpose:** To maintain a real-time balance of how much money the platform owes each tenant.
```sql
CREATE TABLE tenant_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  currency VARCHAR(3) NOT NULL,
  -- The amount available for payout
  available_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  -- The amount that is still processing (e.g., from recent sales)
  pending_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, currency)
);
```

### `balance_transactions`
**Purpose:** A detailed, immutable ledger of every single credit and debit for a tenant's balance. This is critical for accounting and resolving disputes.
```sql
CREATE TABLE balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- The amount and currency of this specific ledger entry
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,

  -- Type of ledger entry for clear accounting
  type VARCHAR(50) NOT NULL, -- 'sale', 'shipping_fee_reimbursement', 'gateway_fee', 'platform_fee', 'refund', 'payout'

  -- Link back to the original source for auditing
  source_order_id UUID REFERENCES orders(id),
  source_payout_id UUID REFERENCES payouts(id),
  source_refund_id UUID REFERENCES refunds(id),

  -- Human-readable description for the merchant's dashboard
  description TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_balance_transactions_tenant_id ON balance_transactions(tenant_id);
```

### `payouts`
**Purpose:** A log of payout requests made to the payment provider (e.g., Airwallex) and their status.
```sql
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  
  -- The ID of the payout transaction from the payment provider (e.g., Airwallex)
  provider_payout_id VARCHAR(255) UNIQUE,

  -- The destination method for the payout
  destination_method_id UUID REFERENCES tenant_payout_methods(id),

  status VARCHAR(50) NOT NULL DEFAULT 'requested', -- requested, pending, in_transit, paid, failed
  
  -- Timestamps
  initiated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  failure_reason TEXT
);

CREATE INDEX idx_payouts_tenant_id ON payouts(tenant_id);
CREATE INDEX idx_payouts_status ON payouts(status);
```

### `tenant_payout_methods`
**Purpose:** To store the safe tokens representing a tenant's payout destinations (e.g., their local bank account).
```sql
CREATE TABLE tenant_payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- The payment provider handling this payout method, e.g., 'airwallex'
  provider VARCHAR(50) NOT NULL,
  
  -- The safe token/ID from the provider that represents the bank account
  provider_method_id VARCHAR(255) NOT NULL,

  -- Safe, displayable details returned by the provider
  -- e.g., "Nabil Bank, Account ending in ****1234"
  display_details TEXT NOT NULL,

  -- Is this the default method for payouts?
  is_default BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, provider_method_id)
);
```

---

## 7. SHIPPING & LOGISTICS TABLES

---

## 8. MARKETING & COMMUNICATIONS TABLES

---

## 9. ANALYTICS & REPORTING TABLES

---

## 10. NEPAL-SPECIFIC TABLES

---

## 11. SYSTEM CONFIGURATION TABLES

---

## 📊 DATABASE STATISTICS

---

## 🔒 SECURITY CONSIDERATIONS

---

## 🚀 PERFORMANCE OPTIMIZATIONS

---

## 📝 NOTES

---

## KEY ARCHITECTURAL NOTES
