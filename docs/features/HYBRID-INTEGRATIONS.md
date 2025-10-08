# Hybrid Integration Architecture (BYOK)

**Document Version**: 1.0.0  
**Status**: Proposed  
**Created**: 2025-10-08  
**Author**: Gemini

---

## 1. Overview

This document outlines a hybrid integration architecture that supports two distinct models for connecting with third-party services: **Platform-Managed** and **Merchant-Managed (Bring Your Own Key - BYOK)**.

The goal is to create a highly flexible and scalable system that caters to two key merchant segments:
1.  **New Merchants:** Who prefer a simple, zero-configuration, out-of-the-box solution.
2.  **Established Merchants:** Who require the ability to use their own existing accounts with third-party providers to leverage their own negotiated rates, branding, and history.

This hybrid approach is critical for maximizing market adoption and ensuring the platform can scale with a merchant's business needs.

---

## 2. Core Concepts

### 2.1. Platform-Managed Integration

-   **How it works:** The platform owns and manages the API credentials for a third-party service. Merchants simply "enable" the service with a toggle in their dashboard.
-   **Billing:** The platform may pass on transaction costs, often at a standard rate, or absorb them as a value-add.
-   **Target Audience:** New merchants, users prioritizing convenience over customization.
-   **Example:** A new store owner enables eSewa payments without needing to register for their own eSewa merchant account.

### 2.2. Merchant-Managed Integration (BYOK)

-   **How it works:** The merchant provides their own API keys, tokens, or other credentials for a third-party service. The platform securely stores these credentials and uses them to make API calls on the merchant's behalf.
-   **Billing:** The merchant is billed directly by the third-party provider. The platform does not mediate the transaction costs.
-   **Target Audience:** Established businesses, power users, merchants with existing provider relationships or negotiated rates.
-   **Example:** An established business with a corporate Pathao account enters their API key to use their pre-negotiated bulk shipping rates.

---

## 3. Affected Services

This hybrid model will be applied to the following categories of integrations:

| Category | Services | Rationale for BYOK |
| :--- | :--- | :--- |
| **Payment Gateways** | eSewa, Khalti, IME Pay | Merchants may have lower transaction fees, existing payout schedules, or established financial history. |
| **Logistics & Shipping** | Pathao, Tootle | Merchants may have corporate accounts with bulk-rate discounts or dedicated pickup schedules. |
| **Communication** | Sparrow SMS, AWS SES | Allows use of a custom branded SMS Sender ID or management of a dedicated email sending reputation. |
| **Analytics & Tracking**| Google Analytics, Facebook Pixel | **BYOK is essential here.** Every merchant must use their own unique tracking and property IDs. |
| **Social Commerce** | Facebook/Instagram Shop | **BYOK is essential here.** Merchants must connect their own business accounts to manage their social pages. |

---

## 4. Database Schema Design

To support the hybrid model, configuration tables for integrations must be updated.

### Example: `payment_gateways` Table

The `payment_gateways` table will be modified to include fields that differentiate the management type and securely store credentials when provided by the merchant.

```sql
CREATE TABLE payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Gateway Info
  gateway VARCHAR(50) NOT NULL, -- esewa, khalti, pathao, etc.
  is_active BOOLEAN DEFAULT false,
  
  -- Hybrid Model Control
  management_type VARCHAR(20) DEFAULT 'platform' NOT NULL, -- Can be 'platform' or 'merchant' (for BYOK)

  -- Merchant-Managed (BYOK) Fields
  -- Stores the AES-256-GCM encrypted JSON blob of API keys.
  credentials_encrypted TEXT,
  -- The Amazon Resource Name (ARN) or ID of the KMS key used to encrypt/decrypt the credentials.
  kms_key_arn TEXT,
  -- Flag to indicate if the merchant-provided credentials have been successfully tested.
  is_verified BOOLEAN DEFAULT false,

  -- Common Settings
  display_name VARCHAR(100),
  is_test_mode BOOLEAN DEFAULT true,
  position INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payment_gateways_tenant_id ON payment_gateways(tenant_id);
```

This same pattern (`management_type`, `credentials_encrypted`, `kms_key_arn`, `is_verified`) will be replicated for other integration tables like `shipping_providers`, `communication_services`, and `analytics_integrations`.

---

## 5. Security Implementation for Credentials

Storing merchant-provided secrets is a critical security responsibility. **Raw credentials must never be stored in the database.**

### Recommended Encryption Flow:

1.  **Key Management:** Use a Key Management Service (KMS) like AWS KMS or Google Cloud KMS to create and manage a primary Customer Master Key (CMK).
2.  **Data Encryption Key (DEK):** When a merchant saves their credentials, the application requests a unique Data Encryption Key (DEK) from the KMS. The KMS returns both a plaintext DEK and an encrypted version of the DEK.
3.  **Encryption:** The application uses the **plaintext DEK** to encrypt the merchant's API keys (e.g., using AES-256-GCM). The plaintext DEK is then immediately discarded.
4.  **Storage:** The application stores the **encrypted API keys** and the **encrypted DEK** in the `credentials_encrypted` field in the database.
5.  **Decryption:** To use the keys, the application retrieves the encrypted blob, sends the encrypted DEK to the KMS, receives the plaintext DEK, decrypts the API keys, and uses them for the API call. The plaintext DEK is then discarded again.

This process, known as envelope encryption, ensures that the data is secure and that the master key never leaves the KMS, providing a strong security posture.

---

## 6. User Experience (UX) Flow

In the merchant dashboard, for each configurable service (e.g., Payments > eSewa):

1.  **Selection:** The merchant is presented with a clear choice:
    *   🔘 **Use Standard Integration** (Recommended for new users)
    *   🔘 **Connect Your Own eSewa Account** (For advanced users)

2.  **Platform-Managed Flow:** If "Standard" is selected, an `is_active` toggle is shown. The setup is complete.

3.  **Merchant-Managed (BYOK) Flow:** If "Connect Your Own" is selected, a form appears requesting the necessary credentials (e.g., "eSewa Merchant ID", "Secret Key").
    *   A **"Test Connection"** button is displayed next to the save button.
    *   When clicked, the backend uses the provided credentials to make a harmless API call (like `getBalance` or `validateToken`).
    *   A success or failure message is shown to the user.
    *   The `is_verified` flag in the database is set to `true` upon successful testing.
    *   The "Save" button will only become active after a successful test.

---

## 7. Backend Abstraction Layer

To manage the dual models cleanly, a factory or strategy design pattern should be used.

### Example: Payment Gateway Factory

```typescript
// interfaces/payment-gateway.ts
interface IPaymentGateway {
  initiatePayment(amount: number, orderId: string): Promise<{ paymentUrl: string }>;
  verifyPayment(transactionId: string): Promise<boolean>;
}

// services/gateways/esewa-platform.ts
class EsewaPlatformGateway implements IPaymentGateway {
  constructor(private platformCredentials) { /* ... */ }
  // ... implementation using platform keys
}

// services/gateways/esewa-merchant.ts
class EsewaMerchantGateway implements IPaymentGateway {
  constructor(private merchantCredentials) { /* ... */ }
  // ... implementation using merchant keys
}

// services/gateway-factory.ts
async function getPaymentGateway(tenantId: string, gateway: string): Promise<IPaymentGateway> {
  const config = await db.payment_gateway.findFirst({ where: { tenantId, gateway } });

  if (config.management_type === 'merchant') {
    // 1. Fetch encrypted credentials from db
    // 2. Call KMS to decrypt them
    // 3. Instantiate and return the merchant-specific gateway
    const decryptedCredentials = await decrypt(config.credentials_encrypted, config.kms_key_arn);
    return new EsewaMerchantGateway(decryptedCredentials);
  } else {
    // Instantiate and return the platform-managed gateway
    return new EsewaPlatformGateway(platformWideCredentials);
  }
}
```

This ensures that the core business logic (e.g., the checkout process) simply calls `getPaymentGateway` and uses the returned instance without needing to know the underlying configuration details. This makes the system clean, maintainable, and easy to extend with new providers.
