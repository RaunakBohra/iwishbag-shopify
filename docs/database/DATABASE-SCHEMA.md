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
  /*
  {
    "custom_domain": true,
    "remove_branding": false,
    "abandoned_cart": true,
    "advanced_analytics": true,
    "social_commerce": true,
    "multi_store": false,
    "api_access": false,
    "priority_support": false
  }
  */

  -- Status
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed data
INSERT INTO subscription_plans (name, slug, price_monthly, price_yearly, max_products, max_orders_per_month) VALUES
('Free', 'free', 0, 0, 25, 50),
('Pro', 'pro', 1999, 19990, -1, -1),
('Max', 'max', 4999, 49990, -1, -1);
```

---

## 2. USER & AUTHENTICATION TABLES

### `users`
**Purpose:** All users (merchants, customers, staff, admins)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for platform admins

  -- Identity
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  username VARCHAR(50) UNIQUE,

  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,

  -- Authentication
  password_hash VARCHAR(255), -- bcrypt
  email_verified_at TIMESTAMP,
  phone_verified_at TIMESTAMP,

  -- Role
  role VARCHAR(20) NOT NULL, -- platform_admin, merchant_owner, merchant_staff, customer

  -- Security
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, deleted
  last_login_at TIMESTAMP,
  last_login_ip VARCHAR(45),

  -- Preferences
  language VARCHAR(5) DEFAULT 'ne',
  timezone VARCHAR(50) DEFAULT 'Asia/Kathmandu',

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role);
```

### `user_sessions`
**Purpose:** Track active sessions for security
```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Session Info
  token VARCHAR(255) UNIQUE NOT NULL,
  refresh_token VARCHAR(255),

  -- Device Info
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_type VARCHAR(50), -- desktop, mobile, tablet

  -- Location (Nepal provinces)
  country VARCHAR(2) DEFAULT 'NP',
  province VARCHAR(50), -- Province 1, Bagmati, etc.
  city VARCHAR(100),

  -- Status
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token);
```

### `social_accounts`
**Purpose:** Social login (Google, Facebook)
```sql
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Provider Info
  provider VARCHAR(50) NOT NULL, -- google, facebook, apple
  provider_user_id VARCHAR(255) NOT NULL,

  -- Tokens
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,

  -- Profile Data
  profile_data JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_social_accounts_user_id ON social_accounts(user_id);
```

### `kyc_documents`
**Purpose:** Nepal business registration KYC
```sql
CREATE TABLE kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Document Type
  document_type VARCHAR(50) NOT NULL,
  -- citizenship, pan_card, vat_certificate, company_registration,
  -- bank_statement, address_proof

  -- Document Info
  document_number VARCHAR(100),
  document_url TEXT NOT NULL, -- S3 URL

  -- Verification
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,
  rejection_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kyc_tenant_id ON kyc_documents(tenant_id);
CREATE INDEX idx_kyc_status ON kyc_documents(status);
```

---

## 3. MERCHANT & STORE TABLES

### `stores`
**Purpose:** E-commerce store configuration (theme, domain, settings)
```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Store Identity
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  favicon_url TEXT,

  -- Domain
  subdomain VARCHAR(100) UNIQUE, -- yourstore.nepshop.com
  custom_domain VARCHAR(255) UNIQUE, -- www.yourstore.com
  domain_verified BOOLEAN DEFAULT false,
  ssl_enabled BOOLEAN DEFAULT true,

  -- Theme
  theme_id UUID REFERENCES themes(id),
  theme_settings JSONB DEFAULT '{}',
  primary_color VARCHAR(7) DEFAULT '#3730a3', -- indigo
  accent_color VARCHAR(7) DEFAULT '#db2777', -- pink

  -- Contact Info
  email VARCHAR(255),
  phone VARCHAR(20),
  whatsapp_number VARCHAR(20),
  viber_number VARCHAR(20),

  -- Address (Nepal)
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  province VARCHAR(50), -- Bagmati, Gandaki, etc.
  district VARCHAR(50),
  postal_code VARCHAR(10),
  country VARCHAR(2) DEFAULT 'NP',

  -- Social Media
  facebook_url TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  twitter_url TEXT,
  youtube_url TEXT,

  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords VARCHAR(500),

  -- Settings
  currency VARCHAR(3) DEFAULT 'NPR',
  language VARCHAR(5) DEFAULT 'ne',
  timezone VARCHAR(50) DEFAULT 'Asia/Kathmandu',
  tax_rate DECIMAL(5,2) DEFAULT 13.00, -- 13% VAT in Nepal

  -- Features
  is_active BOOLEAN DEFAULT true,
  is_maintenance_mode BOOLEAN DEFAULT false,
  maintenance_message TEXT,

  -- Metadata
  settings JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_stores_tenant_id ON stores(tenant_id);
CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_custom_domain ON stores(custom_domain);
```

### `staff_members`
**Purpose:** Store staff with role-based permissions
```sql
CREATE TABLE staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Role & Permissions
  role VARCHAR(50) NOT NULL, -- owner, manager, staff, accountant
  permissions JSONB DEFAULT '[]',
  /*
  [
    "products.view", "products.create", "products.update", "products.delete",
    "orders.view", "orders.update", "orders.refund",
    "customers.view", "customers.update",
    "reports.view", "settings.update"
  ]
  */

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, deleted
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_staff_tenant_id ON staff_members(tenant_id);
CREATE INDEX idx_staff_user_id ON staff_members(user_id);
```

### `themes`
**Purpose:** Pre-built store templates (Nepal-optimized)
```sql
CREATE TABLE themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Theme Info
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  preview_url TEXT,

  -- Categorization
  category VARCHAR(50), -- fashion, electronics, food, general
  is_premium BOOLEAN DEFAULT false,
  price DECIMAL(10,2) DEFAULT 0,

  -- Theme Files
  template_data JSONB NOT NULL, -- Liquid templates, components
  styles JSONB DEFAULT '{}', -- CSS variables

  -- Metadata
  version VARCHAR(10) DEFAULT '1.0.0',
  author VARCHAR(100),
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_themes_slug ON themes(slug);
```

---

## 4. PRODUCT CATALOG TABLES

### `products`
**Purpose:** Core product information
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Basic Info
  title VARCHAR(500) NOT NULL,
  title_ne VARCHAR(500), -- Nepali title
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  description_ne TEXT, -- Nepali description

  -- Categorization
  product_type VARCHAR(100), -- physical, digital, service
  vendor VARCHAR(255), -- Brand/manufacturer

  -- Pricing
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2), -- Original price (for discounts)
  cost_price DECIMAL(10,2), -- Wholesale cost

  -- Inventory
  track_inventory BOOLEAN DEFAULT true,
  sku VARCHAR(100),
  barcode VARCHAR(100),

  -- Weight & Dimensions (for shipping)
  weight DECIMAL(10,2), -- in grams
  weight_unit VARCHAR(10) DEFAULT 'g',
  length DECIMAL(10,2),
  width DECIMAL(10,2),
  height DECIMAL(10,2),
  dimension_unit VARCHAR(10) DEFAULT 'cm',

  -- Tax
  taxable BOOLEAN DEFAULT true,
  tax_rate DECIMAL(5,2),

  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords VARCHAR(500),

  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- draft, active, archived
  published_at TIMESTAMP,

  -- Options (size, color, etc.)
  has_variants BOOLEAN DEFAULT false,
  options JSONB DEFAULT '[]',
  /*
  [
    {"name": "Size", "values": ["S", "M", "L", "XL"]},
    {"name": "Color", "values": ["Red", "Blue", "Green"]}
  ]
  */

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,

  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_sku ON products(sku);
```

### `product_variants`
**Purpose:** Product variations (size, color combinations)
```sql
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Variant Info
  title VARCHAR(255) NOT NULL, -- "Small / Red"
  sku VARCHAR(100) UNIQUE,
  barcode VARCHAR(100),

  -- Pricing
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),

  -- Inventory
  inventory_quantity INT DEFAULT 0,
  inventory_policy VARCHAR(20) DEFAULT 'deny', -- deny, continue (sell when out of stock)

  -- Options (matches product.options)
  option1 VARCHAR(255), -- Size: "Small"
  option2 VARCHAR(255), -- Color: "Red"
  option3 VARCHAR(255),

  -- Weight
  weight DECIMAL(10,2),
  weight_unit VARCHAR(10) DEFAULT 'g',

  -- Image
  image_url TEXT,

  -- Status
  is_available BOOLEAN DEFAULT true,
  position INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
```

### `product_images`
**Purpose:** Product photos (CDN URLs)
```sql
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,

  -- Image Info
  url TEXT NOT NULL, -- CDN URL (S3/Cloudflare R2)
  alt_text VARCHAR(255),
  position INT DEFAULT 0,

  -- Dimensions
  width INT,
  height INT,
  file_size INT, -- in bytes

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);
```

### `collections`
**Purpose:** Product groupings (categories)
```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Collection Info
  title VARCHAR(255) NOT NULL,
  title_ne VARCHAR(255), -- Nepali
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  description_ne TEXT,

  -- Image
  image_url TEXT,

  -- Collection Type
  type VARCHAR(20) DEFAULT 'manual', -- manual, automated
  conditions JSONB, -- For automated collections
  /*
  {
    "rules": [
      {"field": "product_type", "operator": "equals", "value": "Electronics"}
    ]
  }
  */

  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,

  -- Display
  position INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_collections_tenant_id ON collections(tenant_id);
```

### `collection_products`
**Purpose:** Many-to-many relationship
```sql
CREATE TABLE collection_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,

  position INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(collection_id, product_id)
);

CREATE INDEX idx_collection_products_collection_id ON collection_products(collection_id);
CREATE INDEX idx_collection_products_product_id ON collection_products(product_id);
```

### `product_reviews`
**Purpose:** Customer reviews & ratings
```sql
CREATE TABLE product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  -- Review
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  content TEXT,

  -- Merchant Response
  response TEXT,
  responded_at TIMESTAMP,

  -- Moderation
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  moderated_by UUID REFERENCES users(id),
  moderated_at TIMESTAMP,

  -- Metadata
  is_verified_purchase BOOLEAN DEFAULT false,
  helpful_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_reviews_status ON product_reviews(status);
```

---

## 5. ORDER MANAGEMENT TABLES

### `customers`
**Purpose:** Store customers (separate from users)
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL if guest

  -- Contact Info
  email VARCHAR(255),
  phone VARCHAR(20),
  first_name VARCHAR(100),
  last_name VARCHAR(100),

  -- Marketing
  accepts_marketing BOOLEAN DEFAULT false,
  marketing_opt_in_at TIMESTAMP,

  -- Customer Stats
  total_orders INT DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  average_order_value DECIMAL(10,2) DEFAULT 0,

  -- Tags (VIP, Wholesale, etc.)
  tags VARCHAR(255)[],

  -- Notes
  note TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'active', -- active, blocked, deleted

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_order_at TIMESTAMP,

  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX idx_customers_email ON customers(email);
```

### `customer_addresses`
**Purpose:** Saved shipping addresses
```sql
CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,

  -- Address
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company VARCHAR(255),
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  province VARCHAR(50) NOT NULL, -- Nepal provinces
  district VARCHAR(50),
  postal_code VARCHAR(10),
  country VARCHAR(2) DEFAULT 'NP',

  -- Contact
  phone VARCHAR(20),

  -- Flags
  is_default BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_addresses_customer_id ON customer_addresses(customer_id);
```

### `orders`
**Purpose:** Customer orders
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Order Number (human-readable)
  order_number VARCHAR(50) UNIQUE NOT NULL, -- #1001, #1002

  -- Customer
  customer_id UUID REFERENCES customers(id),
  email VARCHAR(255),
  phone VARCHAR(20),

  -- Pricing
  subtotal DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,

  -- Currency
  currency VARCHAR(3) DEFAULT 'NPR',

  -- Addresses
  billing_address JSONB NOT NULL,
  shipping_address JSONB NOT NULL,

  -- Discounts
  discount_codes VARCHAR(50)[],

  -- Payment
  payment_status VARCHAR(20) DEFAULT 'pending',
  -- pending, paid, partially_refunded, refunded, failed
  payment_method VARCHAR(50), -- esewa, khalti, cod, etc.
  payment_gateway_order_id VARCHAR(255),
  paid_at TIMESTAMP,

  -- Fulfillment
  fulfillment_status VARCHAR(20) DEFAULT 'unfulfilled',
  -- unfulfilled, partially_fulfilled, fulfilled, returned, canceled
  fulfilled_at TIMESTAMP,

  -- Shipping
  shipping_method VARCHAR(100),
  tracking_number VARCHAR(255),
  tracking_url TEXT,
  estimated_delivery_date DATE,
  delivered_at TIMESTAMP,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  -- pending, processing, completed, canceled, refunded
  canceled_at TIMESTAMP,
  cancel_reason TEXT,

  -- Customer Notes
  customer_note TEXT,

  -- Staff Notes (internal)
  staff_note TEXT,

  -- Tags
  tags VARCHAR(50)[],

  -- Source
  source VARCHAR(50), -- online_store, facebook, instagram, manual
  source_url TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Financial
  refunded_amount DECIMAL(10,2) DEFAULT 0
);

CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

### `order_items`
**Purpose:** Line items in an order
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,

  -- Product Reference
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,

  -- Product Snapshot (in case product is deleted later)
  title VARCHAR(500) NOT NULL,
  variant_title VARCHAR(255),
  sku VARCHAR(100),
  image_url TEXT,

  -- Pricing
  quantity INT NOT NULL CHECK (quantity > 0),
  price DECIMAL(10,2) NOT NULL, -- Price per unit at time of purchase
  compare_at_price DECIMAL(10,2),
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL, -- (price * quantity) - discount + tax

  -- Fulfillment
  fulfillment_status VARCHAR(20) DEFAULT 'unfulfilled',
  fulfilled_quantity INT DEFAULT 0,

  -- Weight (for shipping)
  weight DECIMAL(10,2),
  weight_unit VARCHAR(10) DEFAULT 'g',

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

### `abandoned_carts`
**Purpose:** Track abandoned checkouts for recovery
```sql
CREATE TABLE abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Customer
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  email VARCHAR(255),
  phone VARCHAR(20),

  -- Cart Data
  items JSONB NOT NULL, -- Snapshot of cart items
  subtotal DECIMAL(10,2),
  total DECIMAL(10,2),

  -- Recovery
  recovery_token VARCHAR(255) UNIQUE,
  recovered BOOLEAN DEFAULT false,
  recovered_order_id UUID REFERENCES orders(id),
  recovered_at TIMESTAMP,

  -- Email Sent
  recovery_email_sent BOOLEAN DEFAULT false,
  recovery_email_sent_at TIMESTAMP,
  recovery_sms_sent BOOLEAN DEFAULT false,
  recovery_sms_sent_at TIMESTAMP,

  -- Expiry
  expires_at TIMESTAMP, -- 30 days from creation

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_abandoned_carts_tenant_id ON abandoned_carts(tenant_id);
CREATE INDEX idx_abandoned_carts_email ON abandoned_carts(email);
CREATE INDEX idx_abandoned_carts_recovered ON abandoned_carts(recovered);
```

---

## 6. PAYMENT & FINANCIAL TABLES

### `payment_gateways`
**Purpose:** Configured payment methods (eSewa, Khalti, etc.)
```sql
CREATE TABLE payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Gateway Info
  gateway VARCHAR(50) NOT NULL, -- esewa, khalti, ime_pay, connectips, fonepay, cod
  gateway_name VARCHAR(100),

  -- Credentials (encrypted)
  credentials JSONB NOT NULL, -- Encrypted API keys
  /*
  {
    "merchant_id": "encrypted_value",
    "secret_key": "encrypted_value"
  }
  */

  -- Settings
  is_active BOOLEAN DEFAULT false,
  is_test_mode BOOLEAN DEFAULT true,
  display_name VARCHAR(100), -- "Credit/Debit Card", "eSewa", etc.
  description TEXT,

  -- Transaction Fee (if merchant wants to pass to customer)
  transaction_fee_type VARCHAR(20), -- fixed, percentage
  transaction_fee_value DECIMAL(10,2) DEFAULT 0,

  -- Display Order
  position INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payment_gateways_tenant_id ON payment_gateways(tenant_id);
```

### `transactions`
**Purpose:** Payment transaction log
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,

  -- Transaction Info
  transaction_id VARCHAR(255) UNIQUE NOT NULL, -- Gateway transaction ID

  -- Gateway
  gateway VARCHAR(50) NOT NULL,
  gateway_transaction_id VARCHAR(255), -- Gateway's reference

  -- Amount
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NPR',

  -- Type
  type VARCHAR(20) NOT NULL, -- payment, refund, chargeback

  -- Status
  status VARCHAR(20) NOT NULL, -- pending, success, failed, canceled

  -- Details
  payment_method VARCHAR(50), -- esewa, khalti, card, cod

  -- Response from Gateway
  gateway_response JSONB,
  error_message TEXT,

  -- Reconciliation
  reconciled BOOLEAN DEFAULT false,
  reconciled_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_tenant_id ON transactions(tenant_id);
CREATE INDEX idx_transactions_order_id ON transactions(order_id);
CREATE INDEX idx_transactions_status ON transactions(status);
```

### `refunds`
**Purpose:** Order refunds
```sql
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,

  -- Refund Amount
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NPR',

  -- Reason
  reason VARCHAR(50), -- customer_request, fraud, duplicate, product_issue
  note TEXT,

  -- Items (which items are being refunded)
  refund_items JSONB NOT NULL,
  /*
  [
    {"order_item_id": "uuid", "quantity": 2, "amount": 1000}
  ]
  */

  -- Restock
  restock BOOLEAN DEFAULT true,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, success, failed

  -- Transaction
  transaction_id UUID REFERENCES transactions(id),

  -- Processed By
  processed_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX idx_refunds_order_id ON refunds(order_id);
```

### `discounts`
**Purpose:** Discount codes & promotions
```sql
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Code
  code VARCHAR(50) UNIQUE NOT NULL, -- DASHAIN2025, WELCOME10

  -- Type
  type VARCHAR(20) NOT NULL, -- percentage, fixed, free_shipping
  value DECIMAL(10,2) NOT NULL, -- 10 (for 10% or Rs 10)

  -- Conditions
  minimum_purchase_amount DECIMAL(10,2) DEFAULT 0,
  maximum_discount_amount DECIMAL(10,2), -- Cap for percentage discounts

  -- Usage Limits
  usage_limit INT, -- NULL = unlimited
  usage_limit_per_customer INT DEFAULT 1,
  usage_count INT DEFAULT 0,

  -- Validity
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP,

  -- Applies To
  applies_to VARCHAR(20) DEFAULT 'all', -- all, specific_products, specific_collections
  applies_to_products UUID[], -- Array of product IDs
  applies_to_collections UUID[], -- Array of collection IDs

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_discounts_code ON discounts(code);
CREATE INDEX idx_discounts_tenant_id ON discounts(tenant_id);
```

---

## 7. SHIPPING & LOGISTICS TABLES

### `shipping_zones`
**Purpose:** Shipping regions (Nepal provinces/cities)
```sql
CREATE TABLE shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Zone Info
  name VARCHAR(100) NOT NULL, -- "Kathmandu Valley", "Province 1", "Nationwide"

  -- Provinces/Cities Covered
  provinces VARCHAR(50)[], -- ["Bagmati", "Gandaki"]
  cities VARCHAR(100)[], -- ["Kathmandu", "Bhaktapur", "Lalitpur"]

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shipping_zones_tenant_id ON shipping_zones(tenant_id);
```

### `shipping_rates`
**Purpose:** Shipping costs per zone
```sql
CREATE TABLE shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_zone_id UUID REFERENCES shipping_zones(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Rate Info
  name VARCHAR(100) NOT NULL, -- "Standard", "Express", "Same Day"
  description TEXT,

  -- Pricing
  price DECIMAL(10,2) NOT NULL,

  -- Conditions
  min_weight DECIMAL(10,2), -- in grams
  max_weight DECIMAL(10,2),
  min_order_amount DECIMAL(10,2),
  max_order_amount DECIMAL(10,2),

  -- Delivery Time
  min_delivery_days INT,
  max_delivery_days INT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shipping_rates_zone_id ON shipping_rates(shipping_zone_id);
```

### `fulfillments`
**Purpose:** Order fulfillment tracking
```sql
CREATE TABLE fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,

  -- Fulfillment Info
  status VARCHAR(20) DEFAULT 'pending',
  -- pending, in_transit, out_for_delivery, delivered, failed, returned

  -- Items Fulfilled
  line_items JSONB NOT NULL, -- Which order items are in this fulfillment
  /*
  [
    {"order_item_id": "uuid", "quantity": 2}
  ]
  */

  -- Tracking
  tracking_company VARCHAR(100), -- Pathao, Tootle, Nepal Post
  tracking_number VARCHAR(255),
  tracking_url TEXT,

  -- Logistics Partner
  logistics_provider VARCHAR(50), -- pathao, tootle, nepal_post, manual

  -- Location Updates
  location_history JSONB DEFAULT '[]',
  /*
  [
    {"timestamp": "2025-10-08T10:00:00Z", "location": "Warehouse", "status": "picked_up"},
    {"timestamp": "2025-10-08T12:00:00Z", "location": "In Transit", "status": "in_transit"}
  ]
  */

  -- Delivery
  delivered_at TIMESTAMP,
  delivered_to VARCHAR(255), -- Name of person who received
  delivery_photo_url TEXT, -- Proof of delivery
  delivery_signature_url TEXT,

  -- Failed Delivery
  failed_reason TEXT,
  failed_attempts INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fulfillments_order_id ON fulfillments(order_id);
CREATE INDEX idx_fulfillments_status ON fulfillments(status);
```

---

## 8. MARKETING & COMMUNICATIONS TABLES

### `email_templates`
**Purpose:** Transactional & marketing email templates
```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Template Info
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  -- order_confirmation, shipping_notification, abandoned_cart,
  -- welcome, newsletter, promotional

  -- Content
  subject VARCHAR(255) NOT NULL,
  subject_ne VARCHAR(255), -- Nepali
  html_body TEXT NOT NULL,
  html_body_ne TEXT,
  text_body TEXT,

  -- Template Variables
  variables JSONB DEFAULT '[]', -- ["{{customer_name}}", "{{order_number}}"]

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_system_template BOOLEAN DEFAULT false, -- Can't be deleted if true

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_templates_tenant_id ON email_templates(tenant_id);
```

### `email_logs`
**Purpose:** Track all sent emails
```sql
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Recipient
  to_email VARCHAR(255) NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Email Info
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  subject VARCHAR(255) NOT NULL,

  -- Related Entity
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  -- pending, sent, delivered, opened, clicked, bounced, complained

  -- Provider Response
  provider VARCHAR(50), -- aws_ses, sendgrid, resend
  provider_message_id VARCHAR(255),

  -- Events
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  bounced_at TIMESTAMP,
  bounce_reason TEXT,

  -- Error
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_logs_tenant_id ON email_logs(tenant_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_to_email ON email_logs(to_email);
```

### `sms_logs`
**Purpose:** Track all sent SMS
```sql
CREATE TABLE sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Recipient
  to_phone VARCHAR(20) NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- SMS Content
  message TEXT NOT NULL,
  message_type VARCHAR(50), -- order_confirmation, otp, delivery_update, marketing

  -- Related Entity
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed

  -- Provider Response
  provider VARCHAR(50), -- sparrow_sms
  provider_message_id VARCHAR(255),

  -- Cost
  cost DECIMAL(10,4), -- Cost per SMS in NPR

  -- Events
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,

  -- Error
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sms_logs_tenant_id ON sms_logs(tenant_id);
CREATE INDEX idx_sms_logs_status ON sms_logs(status);
```

### `marketing_campaigns`
**Purpose:** Email/SMS marketing campaigns (Pro+)
```sql
CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Campaign Info
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL, -- email, sms, both

  -- Content
  email_template_id UUID REFERENCES email_templates(id),
  sms_message TEXT,

  -- Targeting
  segment VARCHAR(50), -- all_customers, repeat_customers, vip, specific
  customer_ids UUID[], -- Specific customers

  -- Filters (for dynamic segments)
  filters JSONB,
  /*
  {
    "total_spent_min": 10000,
    "last_order_days_ago": 30,
    "tags": ["VIP"]
  }
  */

  -- Scheduling
  status VARCHAR(20) DEFAULT 'draft', -- draft, scheduled, sending, sent, paused
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,

  -- Stats
  total_recipients INT DEFAULT 0,
  emails_sent INT DEFAULT 0,
  emails_opened INT DEFAULT 0,
  emails_clicked INT DEFAULT 0,
  sms_sent INT DEFAULT 0,

  -- Conversion Tracking
  orders_generated INT DEFAULT 0,
  revenue_generated DECIMAL(10,2) DEFAULT 0,

  -- Created By
  created_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_campaigns_tenant_id ON marketing_campaigns(tenant_id);
```

---

## 9. ANALYTICS & REPORTING TABLES

### `analytics_events`
**Purpose:** Track user behavior (page views, clicks, etc.)
```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Event Info
  event_type VARCHAR(50) NOT NULL,
  -- page_view, product_view, add_to_cart, checkout_start,
  -- purchase, search, click

  -- Session
  session_id VARCHAR(255),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Device & Location
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_type VARCHAR(20), -- desktop, mobile, tablet
  browser VARCHAR(50),
  os VARCHAR(50),

  -- Location (Nepal)
  country VARCHAR(2) DEFAULT 'NP',
  province VARCHAR(50),
  city VARCHAR(100),

  -- Page Info
  page_url TEXT,
  page_title VARCHAR(255),
  referrer_url TEXT,

  -- Entity Reference
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,

  -- Custom Properties
  properties JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_tenant_id ON analytics_events(tenant_id);
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at);
```

### `daily_stats`
**Purpose:** Pre-aggregated daily statistics (for fast dashboard)
```sql
CREATE TABLE daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Sales
  total_sales DECIMAL(10,2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  average_order_value DECIMAL(10,2) DEFAULT 0,

  -- Products
  products_sold INT DEFAULT 0,

  -- Customers
  new_customers INT DEFAULT 0,
  returning_customers INT DEFAULT 0,

  -- Traffic
  page_views INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,

  -- Conversion
  conversion_rate DECIMAL(5,2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, date)
);

CREATE INDEX idx_daily_stats_tenant_date ON daily_stats(tenant_id, date);
```

---

## 10. NEPAL-SPECIFIC TABLES

### `nepal_provinces`
**Purpose:** Reference data for Nepal's 7 provinces
```sql
CREATE TABLE nepal_provinces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Province Info
  name VARCHAR(50) NOT NULL UNIQUE, -- "Bagmati Pradesh"
  name_ne VARCHAR(50) NOT NULL, -- "बागमती प्रदेश"
  province_number INT NOT NULL, -- 3

  -- Capital
  capital VARCHAR(100), -- "Hetauda"
  capital_ne VARCHAR(100),

  -- Created At
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed data
INSERT INTO nepal_provinces (name, name_ne, province_number, capital, capital_ne) VALUES
('Koshi Pradesh', 'कोशी प्रदेश', 1, 'Biratnagar', 'विराटनगर'),
('Madhesh Pradesh', 'मधेश प्रदेश', 2, 'Janakpur', 'जनकपुर'),
('Bagmati Pradesh', 'बागमती प्रदेश', 3, 'Hetauda', 'हेटौंडा'),
('Gandaki Pradesh', 'गण्डकी प्रदेश', 4, 'Pokhara', 'पोखरा'),
('Lumbini Pradesh', 'लुम्बिनी प्रदेश', 5, 'Deukhuri', 'देउखुरी'),
('Karnali Pradesh', 'कर्णाली प्रदेश', 6, 'Birendranagar', 'बीरेन्द्रनगर'),
('Sudurpashchim Pradesh', 'सुदूरपश्चिम प्रदेश', 7, 'Godawari', 'गोदावरी');
```

### `nepal_districts`
**Purpose:** Nepal's 77 districts
```sql
CREATE TABLE nepal_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id UUID REFERENCES nepal_provinces(id),

  -- District Info
  name VARCHAR(100) NOT NULL,
  name_ne VARCHAR(100) NOT NULL,

  -- Created At
  created_at TIMESTAMP DEFAULT NOW()
);

-- Would seed all 77 districts
```

### `nepal_holidays`
**Purpose:** Nepal public holidays & festivals (for auto-disabling orders)
```sql
CREATE TABLE nepal_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Holiday Info
  name VARCHAR(255) NOT NULL, -- "Dashain", "Tihar", "Holi"
  name_ne VARCHAR(255) NOT NULL,

  -- Date
  date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false, -- Recurring yearly?

  -- Type
  type VARCHAR(50), -- national, festival, observance

  -- Created At
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 11. SYSTEM CONFIGURATION TABLES

### `settings`
**Purpose:** Platform-wide settings
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for global

  -- Setting
  key VARCHAR(100) NOT NULL,
  value TEXT,
  type VARCHAR(20) DEFAULT 'string', -- string, number, boolean, json

  -- Category
  category VARCHAR(50), -- general, payment, shipping, email, sms

  -- Visibility
  is_public BOOLEAN DEFAULT false, -- Can be accessed from frontend?

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, key)
);

CREATE INDEX idx_settings_tenant_id ON settings(tenant_id);
CREATE INDEX idx_settings_key ON settings(key);
```

### `webhooks`
**Purpose:** Webhook subscriptions (for integrations)
```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Webhook Info
  url TEXT NOT NULL,
  events VARCHAR(100)[], -- ["order.created", "order.updated", "product.created"]

  -- Auth
  secret VARCHAR(255), -- For signature verification

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Stats
  last_triggered_at TIMESTAMP,
  failure_count INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhooks_tenant_id ON webhooks(tenant_id);
```

### `webhook_logs`
**Purpose:** Track webhook deliveries
```sql
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,

  -- Event
  event VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,

  -- Delivery
  status VARCHAR(20) NOT NULL, -- pending, success, failed
  http_status_code INT,
  response_body TEXT,
  error_message TEXT,

  -- Retry
  attempts INT DEFAULT 0,
  next_retry_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP
);

CREATE INDEX idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
```

### `api_keys`
**Purpose:** API access for developers (Max tier)
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Key Info
  name VARCHAR(100) NOT NULL, -- "Production API", "Development"
  key_prefix VARCHAR(10) NOT NULL, -- "pk_" for public, "sk_" for secret
  key_hash VARCHAR(255) NOT NULL, -- Hashed full key

  -- Permissions
  scopes VARCHAR(50)[], -- ["read_products", "write_orders", "read_customers"]

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Usage
  last_used_at TIMESTAMP,
  request_count INT DEFAULT 0,

  -- Created By
  created_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
```

### `audit_logs`
**Purpose:** Track all important actions (for security & compliance)
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Actor
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),

  -- Action
  action VARCHAR(100) NOT NULL,
  -- user.login, product.created, order.updated, payment.refunded

  -- Entity
  entity_type VARCHAR(50), -- product, order, customer, user
  entity_id UUID,

  -- Changes
  changes JSONB, -- Before/after values
  /*
  {
    "before": {"price": 1000},
    "after": {"price": 1200}
  }
  */

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## 📊 DATABASE STATISTICS

### Summary
- **Total Tables:** 65+
- **Core System:** 2 tables
- **User & Auth:** 5 tables
- **Merchant & Store:** 4 tables
- **Product Catalog:** 8 tables
- **Orders:** 7 tables
- **Payments:** 4 tables
- **Shipping:** 4 tables
- **Marketing:** 5 tables
- **Analytics:** 2 tables
- **Nepal-Specific:** 3 tables
- **System Config:** 6 tables

### Indexes
- **Primary Indexes:** 65+ (one per table on `id`)
- **Foreign Key Indexes:** 100+
- **Query Optimization Indexes:** 50+
- **Total:** 215+ indexes

### Estimated Storage (for 1000 active merchants)
- **Products:** ~5 GB
- **Orders:** ~10 GB
- **Images/Files:** ~100 GB (S3)
- **Analytics Events:** ~20 GB
- **Logs:** ~5 GB
- **Total:** ~140 GB

---

## 🔒 SECURITY CONSIDERATIONS

### Row-Level Security (RLS)
```sql
-- Example: Ensure tenants can only see their own data
CREATE POLICY tenant_isolation ON products
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### Encryption
- **At Rest:** PostgreSQL transparent data encryption (TDE)
- **In Transit:** SSL/TLS connections only
- **Sensitive Fields:**
  - `payment_gateways.credentials` - Encrypted with AES-256
  - `users.password_hash` - bcrypt (cost factor 12)
  - `users.two_factor_secret` - Encrypted

### Backup Strategy
- **Frequency:** Daily automated backups
- **Retention:** 30 days
- **Point-in-Time Recovery:** Enabled (PITR)
- **Offsite Backup:** AWS S3 cross-region replication

---

## 🚀 PERFORMANCE OPTIMIZATIONS

### Indexes
- All foreign keys have indexes
- Composite indexes on frequently queried columns
- Partial indexes for common WHERE clauses

### Partitioning
```sql
-- Partition large tables by date
CREATE TABLE analytics_events (...)
PARTITION BY RANGE (created_at);

CREATE TABLE analytics_events_2025_10
PARTITION OF analytics_events
FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

### Caching Strategy
- **Redis Cache:** Hot data (products, collections, settings)
- **CDN:** Static assets, product images
- **Application-level:** Query result caching (15-60 seconds)

### Query Optimization
- Use `EXPLAIN ANALYZE` for slow queries
- Materialized views for complex reports
- Connection pooling (PgBouncer)

---

## 📝 NOTES

### Prisma Schema
The complete Prisma schema will be generated in: `prisma/schema.prisma`

### Migrations
All migrations will be stored in: `prisma/migrations/`

### Seeding
Initial data seeding scripts in: `prisma/seed.ts`

---

**Last Updated:** 2025-10-08
**Schema Version:** 2.0.0
**Architecture:** Single shared database with tenant_id isolation (RLS)
**Next Review:** When adding new features

---

## KEY ARCHITECTURAL NOTES

**Multi-Tenancy Implementation:**
- All tenant-scoped tables have `tenant_id UUID` column
- PostgreSQL Row-Level Security (RLS) enforces tenant isolation
- Composite indexes on `(tenant_id, ...)` for optimal query performance
- Single database serves all tenants (simpler, cheaper, industry-standard)

**Why Shared Database?**
- ✅ Cost: $144/month for 1000 tenants vs $600-2000 for database-per-tenant
- ✅ Simplicity: One migration = all tenants updated
- ✅ Industry Standard: Used by Shopify, Stripe, Slack, GitHub
- ✅ Proven at scale: 100k+ tenants possible

See [NEON-MULTI-TENANT.md](./NEON-MULTI-TENANT.md) for implementation details.

