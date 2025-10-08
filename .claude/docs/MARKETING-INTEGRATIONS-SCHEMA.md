# 📧 MARKETING, INTEGRATIONS & DATABASE SCHEMA
## Nepal E-Commerce Platform - Service Management Architecture

**Document Version**: 1.0.0  
**Last Updated**: 2025-10-08  
**Focus**: SMS/Email Marketing, Third-party Integrations, Database Schema  

---

## 📧 SMS & EMAIL MARKETING SYSTEM

### 💰 **SERVICE PURCHASING MODEL**

#### **SMS Credits System**
```
Free Tier: 0 SMS credits
Pro Tier: 1,000 SMS/month (included)
Max Tier: 5,000 SMS/month (included)
Additional: Rs 2/SMS (bulk discounts available)
```

#### **Email Marketing Limits**
```
Free Tier: 0 marketing emails
Pro Tier: 5,000 emails/month (included)
Max Tier: Unlimited emails/month
Additional: Rs 0.50/email (bulk discounts)
```

#### **Service Purchase Flow**
1. **Credit Purchase**: Merchants buy SMS/email credits
2. **Usage Tracking**: Real-time credit consumption
3. **Auto-renewal**: Optional monthly credit top-up
4. **Bulk Discounts**: Volume-based pricing tiers

### 📱 **SMS MARKETING SYSTEM**

#### **SMS Service Providers**
- **Primary**: Sparrow SMS (Nepal's leading SMS provider)
- **Backup**: SMS Nepal, Vianet SMS
- **International**: Twilio (for global reach)

#### **SMS Event Triggers**
```javascript
// SMS Event Triggers
const smsEvents = {
  // Order Events
  ORDER_CONFIRMED: 'order_confirmed',
  ORDER_SHIPPED: 'order_shipped', 
  ORDER_DELIVERED: 'order_delivered',
  ORDER_CANCELLED: 'order_cancelled',
  
  // Marketing Events
  WELCOME_SMS: 'welcome_sms',
  BIRTHDAY_WISH: 'birthday_wish',
  PROMOTIONAL_SMS: 'promotional_sms',
  ABANDONED_CART: 'abandoned_cart',
  
  // Verification Events
  OTP_VERIFICATION: 'otp_verification',
  PHONE_VERIFICATION: 'phone_verification',
  
  // Delivery Events
  DELIVERY_UPDATE: 'delivery_update',
  DELIVERY_CONFIRMATION: 'delivery_confirmation'
}
```

#### **SMS Template System**
```javascript
// SMS Templates (Nepali + English)
const smsTemplates = {
  ORDER_CONFIRMED: {
    ne: "नमस्कार {customer_name}, आफ्नो आदेश #{order_id} पुष्टि भयो। कुल रकम: रू {total_amount}",
    en: "Hello {customer_name}, your order #{order_id} is confirmed. Total: Rs {total_amount}"
  },
  ORDER_SHIPPED: {
    ne: "आफ्नो आदेश #{order_id} पठाइयो। ट्र्याकिङ कोड: {tracking_code}",
    en: "Your order #{order_id} has been shipped. Tracking: {tracking_code}"
  },
  PROMOTIONAL: {
    ne: "विशेष छुट! {discount_percent}% छुट {product_name} मा। समाप्ति: {expiry_date}",
    en: "Special offer! {discount_percent}% off on {product_name}. Expires: {expiry_date}"
  }
}
```

### 📧 **EMAIL MARKETING SYSTEM**

#### **Email Service Architecture**
- **Primary**: AWS SES (transactional emails)
- **Marketing**: SendGrid (bulk email campaigns)
- **Backup**: Mailgun, Resend

#### **Email Event Triggers**
```javascript
// Email Event Triggers
const emailEvents = {
  // Transactional Emails
  WELCOME_EMAIL: 'welcome_email',
  ORDER_CONFIRMATION: 'order_confirmation',
  SHIPPING_NOTIFICATION: 'shipping_notification',
  DELIVERY_CONFIRMATION: 'delivery_confirmation',
  
  // Marketing Emails
  NEWSLETTER: 'newsletter',
  PROMOTIONAL_CAMPAIGN: 'promotional_campaign',
  BIRTHDAY_EMAIL: 'birthday_email',
  ABANDONED_CART_RECOVERY: 'abandoned_cart_recovery',
  
  // System Emails
  PASSWORD_RESET: 'password_reset',
  ACCOUNT_VERIFICATION: 'account_verification'
}
```

#### **Email Template System**
```javascript
// Email Templates (Responsive, Bilingual)
const emailTemplates = {
  ORDER_CONFIRMATION: {
    subject: {
      ne: "आदेश पुष्टि - #{order_id}",
      en: "Order Confirmation - #{order_id}"
    },
    template: "order-confirmation.html",
    variables: ["customer_name", "order_id", "total_amount", "items"]
  },
  NEWSLETTER: {
    subject: {
      ne: "हाम्रो नयाँ उत्पादहरू हेर्नुहोस्",
      en: "Check out our new products"
    },
    template: "newsletter.html",
    variables: ["customer_name", "products", "offers"]
  }
}
```

---

## 🔌 THIRD-PARTY INTEGRATIONS

### 🚚 **LOGISTICS INTEGRATIONS**

#### **Pathao Integration**
```javascript
// Pathao API Integration
const pathaoIntegration = {
  api_endpoint: "https://api-hermes.pathao.com/api/v1",
  services: {
    CREATE_ORDER: "/orders",
    TRACK_ORDER: "/orders/{order_id}",
    GET_RATES: "/rates",
    CANCEL_ORDER: "/orders/{order_id}/cancel"
  },
  authentication: {
    type: "Bearer Token",
    token_refresh: "auto"
  }
}
```

#### **Tootle Integration**
```javascript
// Tootle API Integration
const tootleIntegration = {
  api_endpoint: "https://api.tootle.com.np/v1",
  services: {
    CREATE_DELIVERY: "/deliveries",
    TRACK_DELIVERY: "/deliveries/{delivery_id}",
    GET_QUOTE: "/quote",
    CANCEL_DELIVERY: "/deliveries/{delivery_id}/cancel"
  }
}
```

#### **Nepal Post Integration**
```javascript
// Nepal Post API Integration
const nepalPostIntegration = {
  api_endpoint: "https://api.nepalpost.gov.np/v1",
  services: {
    CREATE_PARCEL: "/parcels",
    TRACK_PARCEL: "/parcels/{tracking_number}",
    GET_RATES: "/rates",
    PRINT_LABEL: "/labels"
  }
}
```

### 📱 **SOCIAL COMMERCE INTEGRATIONS**

#### **Facebook Shop Integration**
```javascript
// Facebook Shop Auto-Sync
const facebookShopIntegration = {
  api_endpoint: "https://graph.facebook.com/v18.0",
  services: {
    SYNC_PRODUCTS: "/{catalog_id}/products",
    UPDATE_INVENTORY: "/{product_id}",
    SYNC_ORDERS: "/{catalog_id}/orders",
    GET_ANALYTICS: "/{catalog_id}/insights"
  },
  webhooks: {
    ORDER_CREATED: "order_created",
    ORDER_UPDATED: "order_updated",
    PRODUCT_SYNC: "product_sync"
  }
}
```

#### **Instagram Shop Integration**
```javascript
// Instagram Shop Integration
const instagramShopIntegration = {
  api_endpoint: "https://graph.facebook.com/v18.0",
  services: {
    SYNC_PRODUCTS: "/{instagram_business_id}/products",
    CREATE_SHOPPING_POST: "/{instagram_business_id}/media",
    GET_INSIGHTS: "/{instagram_business_id}/insights"
  }
}
```

#### **WhatsApp Business Integration**
```javascript
// WhatsApp Business API
const whatsappIntegration = {
  api_endpoint: "https://graph.facebook.com/v18.0",
  services: {
    SEND_MESSAGE: "/{phone_number_id}/messages",
    SEND_TEMPLATE: "/{phone_number_id}/messages",
    GET_WEBHOOK: "/{phone_number_id}/webhooks"
  },
  templates: {
    ORDER_CONFIRMATION: "order_confirmation_template",
    DELIVERY_UPDATE: "delivery_update_template",
    PROMOTIONAL: "promotional_template"
  }
}
```

### 📊 **ANALYTICS INTEGRATIONS**

#### **Google Analytics 4**
```javascript
// Google Analytics 4 Integration
const ga4Integration = {
  measurement_id: "G-XXXXXXXXXX",
  events: {
    PURCHASE: "purchase",
    ADD_TO_CART: "add_to_cart",
    VIEW_ITEM: "view_item",
    BEGIN_CHECKOUT: "begin_checkout"
  },
  custom_dimensions: {
    CUSTOMER_SEGMENT: "customer_segment",
    PRODUCT_CATEGORY: "product_category",
    PAYMENT_METHOD: "payment_method"
  }
}
```

#### **Google Tag Manager**
```javascript
// Google Tag Manager Integration
const gtmIntegration = {
  container_id: "GTM-XXXXXXX",
  triggers: {
    PAGE_VIEW: "page_view",
    CLICK: "click",
    FORM_SUBMIT: "form_submit",
    ECOMMERCE: "ecommerce"
  },
  variables: {
    CUSTOMER_ID: "customer_id",
    ORDER_VALUE: "order_value",
    PRODUCT_SKU: "product_sku"
  }
}
```

---

## 🗄️ DATABASE SCHEMA

### Store Settings Keys (by section)
```json
{
  "general": {
    "store_name": "Gulmohar",
    "business_category": "fashion",
    "contact_phone": "+9779800000000",
    "contact_email": "store@example.com",
    "address": {"province": 3, "district": "Kathmandu", "address1": "Lokanthali-4"}
  },
  "plan_billing": {
    "plan": "pro",
    "trial_ends_at": "2025-11-01T00:00:00Z",
    "payment_method": {"provider": "wallet", "last4": "4242"},
    "tax_profile": {"vat_number": "123456789", "registered_name": "Gulmohar Pvt Ltd"}
  },
  "privacy": {
    "cookie_banner": {"enabled": true, "variant": "bottom"},
    "consent_purposes": ["analytics", "marketing"],
    "dsr": {"self_service": true}
  },
  "notifications": {
    "email": {"provider": "ses", "from_address": "noreply@store.com"},
    "sms": {"provider": "sparrow", "sender_id": "NEPSHOP"}
  },
  "integrations": {
    "pathao": {"active": false},
    "tootle": {"active": false},
    "facebook": {"active": true},
    "ga4": {"measurement_id": "G-XXXX"},
    "gtm": {"container_id": "GTM-XXXX"}
  },
  "locations": [{"code": "WH-KTM", "name": "Kathmandu Warehouse"}],
  "apps_hub": {"tokens": [{"app": "zapier", "scopes": ["orders:read"]}]},
  "metafields": {"product": [{"key": "hsn", "type": "string"}]}
}
```

### **CORE ENTITIES**

#### **1. Store Management**
```sql
-- Stores Table
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  domain VARCHAR(255),
  subdomain VARCHAR(255) UNIQUE,
  owner_id UUID REFERENCES users(id),
  business_category VARCHAR(100),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  address TEXT,
  timezone VARCHAR(50) DEFAULT 'Asia/Kathmandu',
  currency VARCHAR(3) DEFAULT 'NPR',
  language VARCHAR(5) DEFAULT 'en',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Store Settings Table
CREATE TABLE store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_id, setting_key)
);
```

#### **2. SMS & Email Management**
```sql
-- SMS Credits Table
CREATE TABLE sms_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  credits_available INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  credits_purchased INTEGER DEFAULT 0,
  last_purchase_date TIMESTAMP,
  auto_renewal BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- SMS Templates Table
CREATE TABLE sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  template_name VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  template_ne TEXT,
  template_en TEXT,
  variables JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- SMS Campaigns Table
CREATE TABLE sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  campaign_name VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES sms_templates(id),
  target_segment VARCHAR(100),
  message_text TEXT NOT NULL,
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'draft',
  total_recipients INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Email Credits Table
CREATE TABLE email_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  credits_available INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  credits_purchased INTEGER DEFAULT 0,
  last_purchase_date TIMESTAMP,
  auto_renewal BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Email Templates Table
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  template_name VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  subject_ne VARCHAR(255),
  subject_en VARCHAR(255),
  html_template TEXT,
  text_template TEXT,
  variables JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Email Campaigns Table
CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  campaign_name VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES email_templates(id),
  target_segment VARCHAR(100),
  subject VARCHAR(255) NOT NULL,
  html_content TEXT,
  text_content TEXT,
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'draft',
  total_recipients INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  bounced_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **3. Integration Management**
```sql
-- Integrations Table
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  integration_type VARCHAR(50) NOT NULL, -- 'pathao', 'tootle', 'facebook', 'google_analytics'
  integration_name VARCHAR(100) NOT NULL,
  api_credentials JSONB, -- Encrypted API keys, tokens
  configuration JSONB, -- Integration-specific settings
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  sync_status VARCHAR(20) DEFAULT 'pending',
  error_log TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Integration Logs Table
CREATE TABLE integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id),
  action VARCHAR(100) NOT NULL,
  request_data JSONB,
  response_data JSONB,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  execution_time INTEGER, -- milliseconds
  created_at TIMESTAMP DEFAULT NOW()
);

-- Webhooks Table
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  integration_id UUID REFERENCES integrations(id),
  webhook_url VARCHAR(500) NOT NULL,
  events JSONB, -- Array of events to listen for
  secret_key VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **4. Analytics & Tracking**
```sql
-- Analytics Events Table
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  event_type VARCHAR(50) NOT NULL,
  event_name VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(255),
  properties JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Google Analytics Configuration
CREATE TABLE ga_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  measurement_id VARCHAR(20) NOT NULL,
  api_secret VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Google Tag Manager Configuration
CREATE TABLE gtm_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  container_id VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **5. Service Purchases & Billing**
```sql
-- Service Purchases Table
CREATE TABLE service_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  service_type VARCHAR(50) NOT NULL, -- 'sms_credits', 'email_credits', 'premium_features'
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50),
  payment_status VARCHAR(20) DEFAULT 'pending',
  transaction_id VARCHAR(255),
  purchased_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Service Usage Table
CREATE TABLE service_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id),
  service_type VARCHAR(50) NOT NULL,
  usage_count INTEGER DEFAULT 0,
  usage_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_id, service_type, usage_date)
);
```

---

## 🔧 **SERVICE MANAGEMENT ARCHITECTURE**

### **1. Credit Management System**
```javascript
// Credit Management Service
class CreditManager {
  async purchaseCredits(storeId, serviceType, quantity) {
    // Calculate pricing with bulk discounts
    const pricing = await this.calculatePricing(serviceType, quantity);
    
    // Process payment
    const payment = await this.processPayment(storeId, pricing.total);
    
    // Add credits to store
    await this.addCredits(storeId, serviceType, quantity);
    
    // Log transaction
    await this.logPurchase(storeId, serviceType, quantity, pricing);
  }
  
  async useCredits(storeId, serviceType, amount) {
    // Check available credits
    const credits = await this.getAvailableCredits(storeId, serviceType);
    
    if (credits < amount) {
      throw new Error('Insufficient credits');
    }
    
    // Deduct credits
    await this.deductCredits(storeId, serviceType, amount);
    
    // Log usage
    await this.logUsage(storeId, serviceType, amount);
  }
}
```

### **2. Event-Driven Marketing System**
```javascript
// Marketing Event System
class MarketingEventSystem {
  async triggerSMS(eventType, storeId, customerId, data) {
    // Get SMS template
    const template = await this.getSMSTemplate(storeId, eventType);
    
    // Check credits
    await this.checkCredits(storeId, 'sms', 1);
    
    // Send SMS
    const result = await this.sendSMS(template, data);
    
    // Log usage
    await this.logUsage(storeId, 'sms', 1);
    
    return result;
  }
  
  async triggerEmail(eventType, storeId, customerId, data) {
    // Get email template
    const template = await this.getEmailTemplate(storeId, eventType);
    
    // Check credits
    await this.checkCredits(storeId, 'email', 1);
    
    // Send email
    const result = await this.sendEmail(template, data);
    
    // Log usage
    await this.logUsage(storeId, 'email', 1);
    
    return result;
  }
}
```

### **3. Integration Management System**
```javascript
// Integration Manager
class IntegrationManager {
  async syncWithPathao(storeId, orderData) {
    const integration = await this.getIntegration(storeId, 'pathao');
    
    if (!integration.is_active) {
      throw new Error('Pathao integration not active');
    }
    
    // Create delivery order
    const result = await this.pathaoAPI.createOrder(orderData);
    
    // Log integration activity
    await this.logIntegrationActivity(integration.id, 'create_order', result);
    
    return result;
  }
  
  async syncWithFacebook(storeId, productData) {
    const integration = await this.getIntegration(storeId, 'facebook');
    
    if (!integration.is_active) {
      throw new Error('Facebook integration not active');
    }
    
    // Sync product to Facebook Shop
    const result = await this.facebookAPI.syncProduct(productData);
    
    // Log integration activity
    await this.logIntegrationActivity(integration.id, 'sync_product', result);
    
    return result;
  }
}
```

---

## 📊 **ANALYTICS & REPORTING**

### **Marketing Analytics Dashboard**
```javascript
// Marketing Analytics
const marketingAnalytics = {
  sms_metrics: {
    total_sent: "SELECT COUNT(*) FROM sms_campaigns WHERE status = 'sent'",
    delivery_rate: "SELECT (delivered_count / total_recipients) * 100 FROM sms_campaigns",
    cost_per_sms: "SELECT AVG(unit_price) FROM service_purchases WHERE service_type = 'sms_credits'"
  },
  
  email_metrics: {
    total_sent: "SELECT COUNT(*) FROM email_campaigns WHERE status = 'sent'",
    open_rate: "SELECT (opened_count / delivered_count) * 100 FROM email_campaigns",
    click_rate: "SELECT (clicked_count / delivered_count) * 100 FROM email_campaigns",
    bounce_rate: "SELECT (bounced_count / delivered_count) * 100 FROM email_campaigns"
  },
  
  integration_metrics: {
    pathao_orders: "SELECT COUNT(*) FROM integration_logs WHERE integration_type = 'pathao' AND action = 'create_order'",
    facebook_syncs: "SELECT COUNT(*) FROM integration_logs WHERE integration_type = 'facebook' AND action = 'sync_product'"
  }
}
```

---

## 🎯 **IMPLEMENTATION PRIORITY**

### **Sprint 8: SMS & Email Foundation**
- SMS credit system
- Email credit system
- Basic templates
- Event triggers

### **Sprint 9: Marketing Automation**
- Campaign management
- Customer segmentation
- Automated triggers
- Analytics dashboard

### **Sprint 10: Third-party Integrations**
- Pathao integration
- Tootle integration
- Facebook Shop sync
- Google Analytics

### **Sprint 11: Advanced Features**
- WhatsApp integration
- Viber integration
- Advanced analytics
- Webhook system

---

**Document Status**: ✅ COMPLETE  
**Total Services**: 15+ integrations  
**Database Tables**: 25+ tables  
**API Endpoints**: 50+ endpoints  
**Next Step**: Begin Sprint 8 implementation
