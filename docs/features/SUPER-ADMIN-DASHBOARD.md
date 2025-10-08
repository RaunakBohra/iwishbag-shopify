# Feature: Super-Admin Dashboard

**Document Version**: 1.0.0  
**Status**: Proposed  
**Created**: 2025-10-08  
**Author**: Gemini

---

## 1. Objective

To create a secure, centralized, internal web application for platform administrators (i.e., you and your team) to manage, monitor, and operate the entire Nepal E-Commerce SaaS platform. This dashboard is the control panel for the business itself and is entirely separate from the merchant-facing dashboard.

---

## 2. Key Modules & Features

### 2.1. Main Dashboard

- **Platform-Wide KPIs:** A real-time overview of the entire ecosystem.
  - Total Revenue (MRR/ARR)
  - Total Active Merchants
  - New Sign-ups (daily/weekly/monthly)
  - Total Orders Across Platform
  - Total Gross Merchandise Volume (GMV)
  - Subscription Health (Active vs. Trial vs. Canceled)
- **System Health At-a-Glance:**
  - API Uptime & Latency (p95)
  - Database Connection Status
  - Background Queue (Cloudflare Queues) job status (processed vs. failed).
- **Recent Activity Feed:**
  - New merchant sign-ups.
  - High-value orders.
  - Failed payments or system errors.

### 2.2. Tenant (Merchant) Management

- **Tenant List:** A searchable, sortable, and filterable table of all merchants on the platform.
  - Columns: Store Name, Owner Email, Plan (Free/Pro/Max), Status (Active/Trial/Suspended), Sign-up Date, Total Revenue.
- **Tenant Detail View:** A comprehensive view of a single merchant's account.
  - **Impersonation:** A "Login as Merchant" button for support purposes (with strict auditing).
  - **Account Actions:** Suspend, unsuspend, or delete a merchant account.
  - **Plan Management:** Manually upgrade or downgrade a merchant's subscription plan.
  - **Data View:** Read-only access to the merchant's products, orders, and customers for support.

### 2.3. Subscription & Billing Management

- **Subscription Plans:** A UI to create and edit the platform's subscription plans (Free, Pro, Max), including their pricing, feature flags, and limits (e.g., `max_products`).
- **Invoicing:** View and manage invoices sent to merchants for their subscription fees.
- **Revenue Analytics:** Detailed reports on MRR, churn rate, lifetime value (LTV), and average revenue per user (ARPU).

### 2.4. Platform Settings

- **Feature Flags:** Globally enable or disable major new features.
- **Integrations Management:** Manage the platform-wide API keys for services like Sparrow SMS, AWS SES, and the platform-managed payment gateways.
- **Announcement Banner:** Push a global announcement banner to all merchant dashboards (e.g., for scheduled maintenance).

### 2.5. Support & Monitoring

- **Centralized Logging:** An interface to view and search application logs from across the platform (integrating with Better Stack or similar).
- **Support Tickets:** A simple system to manage support requests coming from merchants.

---

## 3. Technical Implementation

- **Application:** This will be a completely separate Next.js application, hosted on Cloudflare Pages at a private subdomain (e.g., `internal-admin.nepshop.com`).
- **Authentication:** Access will be strictly limited via Cloudflare Zero Trust or a similar access control service, restricted to a predefined list of administrator Google accounts. This ensures it is not exposed to the public internet.
- **API:** It will consume a dedicated set of API endpoints (e.g., `/api/super-admin/*`) that require a `platform_admin` role, as defined in the `users` table schema.
- **Database:** The dashboard will interact directly with the primary platform database, with the ability to query across all `tenant_id`s.

---

## 4. Priority & Sprint Assignment

- **Priority:** **P0 (Critical)**. While not needed for merchants to sign up, it is essential for the business to operate. Development should happen in parallel with the core merchant-facing features.
- **Proposed Sprint:** Sprints 3-4.
