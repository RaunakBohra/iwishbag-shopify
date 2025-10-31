# Nepal-Specific Services Integration Guide

Complete integration guide for Nepal-specific payment gateways, logistics, and communication services. Track execution in `docs/integrations/IMPLEMENTATION-CHECKLIST.md`.

---

## Table of Contents

1. [Payment Gateways](#payment-gateways)
   - [eSewa](#esewa)
   - [Khalti](#khalti)
   - [IME Pay](#ime-pay)
   - [ConnectIPS](#connectips)
   - [FonePay](#fonepay)
2. [Logistics & Delivery](#logistics--delivery)
   - [Pathao](#pathao)
   - [Tootle](#tootle)
3. [Communication](#communication)
   - [Sparrow SMS](#sparrow-sms)
4. [Localization](#localization)
   - [Nepal Provinces & Districts](#nepal-provinces--districts)
   - [Nepali Language Support](#nepali-language-support)
5. [Compliance](#compliance)

---

## Payment Gateways

### eSewa

**Nepal's largest digital wallet** - 5+ million users

#### API Costs

- **Integration Fee**: Rs 25,000 (one-time)
- **Transaction Fee**: 2% per transaction
- **Settlement**: T+1 days

**Platform Strategy**: Absorb Rs 25,000 cost, provide to ALL merchants for free (competitive advantage).

#### Setup

1. **Create eSewa Merchant Account**

```bash
# Contact eSewa
Email: merchant@esewa.com.np
Phone: +977-1-5970777
Office: Kamalpokhari, Kathmandu

# Required documents:
- Company registration certificate
- PAN certificate
- Bank account details
- Director citizenship copy
```

2. **Get API Credentials**

After approval, eSewa provides:
- Merchant ID (e.g., `EPAYTEST` for sandbox)
- Secret Key
- Service Code

#### Integration

**Environment Variables** (`.dev.vars`):

```bash
ESEWA_MERCHANT_ID="EPAYTEST"
ESEWA_SECRET_KEY="8gBm/:&EnhH.1/q"
ESEWA_ENVIRONMENT="test"  # test or production
ESEWA_SUCCESS_URL="https://api.nepshop.com/webhooks/esewa/success"
ESEWA_FAILURE_URL="https://api.nepshop.com/webhooks/esewa/failure"
```

**Payment Initiation** (`src/services/payment/esewa.ts`):

```typescript
import crypto from 'crypto'
import { Env } from '../../index'

interface ESewaPaymentParams {
  orderId: string
  amount: number
  taxAmount: number
  serviceCharge: number
  deliveryCharge: number
  totalAmount: number
  merchantName: string
  customerInfo: {
    name: string
    email: string
    phone: string
  }
}

export async function initiateESewaPayment(
  params: ESewaPaymentParams,
  env: Env
): Promise<{ paymentUrl: string; signature: string }> {
  const {
    orderId,
    amount,
    taxAmount,
    serviceCharge,
    deliveryCharge,
    totalAmount,
    merchantName
  } = params

  // Generate signature
  const message = `total_amount=${totalAmount},transaction_uuid=${orderId},product_code=${env.ESEWA_MERCHANT_ID}`

  const signature = crypto
    .createHmac('sha256', env.ESEWA_SECRET_KEY)
    .update(message)
    .digest('base64')

  // Build payment URL
  const baseUrl = env.ESEWA_ENVIRONMENT === 'production'
    ? 'https://epay.esewa.com.np/api/epay/main/v2/form'
    : 'https://uat.esewa.com.np/epay/main'

  const paymentUrl = `${baseUrl}?` + new URLSearchParams({
    amt: amount.toString(),
    psc: serviceCharge.toString(),
    pdc: deliveryCharge.toString(),
    txAmt: taxAmount.toString(),
    tAmt: totalAmount.toString(),
    pid: orderId,
    scd: env.ESEWA_MERCHANT_ID,
    su: env.ESEWA_SUCCESS_URL,
    fu: env.ESEWA_FAILURE_URL
  }).toString()

  return { paymentUrl, signature }
}

export async function verifyESewaPayment(
  refId: string,
  totalAmount: number,
  env: Env
): Promise<boolean> {
  const verifyUrl = env.ESEWA_ENVIRONMENT === 'production'
    ? 'https://epay.esewa.com.np/api/epay/transaction/status'
    : 'https://uat.esewa.com.np/epay/transrec'

  const response = await fetch(verifyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      product_code: env.ESEWA_MERCHANT_ID,
      total_amount: totalAmount,
      transaction_uuid: refId
    })
  })

  const data = await response.json()

  return data.status === 'COMPLETE'
}
```

**API Route** (`src/routes/payment.ts`):

```typescript
import { Hono } from 'hono'
import { initiateESewaPayment, verifyESewaPayment } from '../services/payment/esewa'
import { getTenantDatabase } from '../services/database'

const app = new Hono<{ Bindings: Env }>()

app.post('/payment/esewa/initiate', async (c) => {
  const tenantId = c.get('tenantId')
  const { orderId } = await c.req.json()

  // Get order from database
  const db = await getTenantDatabase(tenantId, c.env)
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: true }
  })

  if (!order) {
    return c.json({ error: 'Order not found' }, 404)
  }

  // Initiate payment
  const payment = await initiateESewaPayment({
    orderId: order.id,
    amount: order.subtotal,
    taxAmount: order.tax,
    serviceCharge: 0,
    deliveryCharge: order.shippingCost,
    totalAmount: order.total,
    merchantName: 'Your Store',
    customerInfo: {
      name: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone
    }
  }, c.env)

  // Update order with payment details
  await db.order.update({
    where: { id: orderId },
    data: {
      paymentGateway: 'esewa',
      paymentStatus: 'pending',
      paymentSignature: payment.signature
    }
  })

  return c.json({
    paymentUrl: payment.paymentUrl,
    signature: payment.signature
  })
})

// Webhook handlers
app.get('/webhooks/esewa/success', async (c) => {
  const refId = c.req.query('refId')
  const orderId = c.req.query('oid')
  const amount = parseFloat(c.req.query('amt') || '0')

  // Verify payment
  const isValid = await verifyESewaPayment(refId, amount, c.env)

  if (!isValid) {
    return c.redirect('https://merchant.nepshop.com/orders?payment=failed')
  }

  // Get tenant from order
  const platformDb = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL })
  const order = await platformDb.order.findUnique({
    where: { id: orderId },
    select: { tenantId: true }
  })

  const db = await getTenantDatabase(order.tenantId, c.env)

  // Update order status
  await db.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'completed',
      paymentRefId: refId,
      paymentCompletedAt: new Date(),
      status: 'processing'
    }
  })

  // Send confirmation email (via queue)
  await sendToQueue({
    type: 'email',
    to: order.customer.email,
    subject: 'Payment Successful',
    body: `Your payment of Rs ${amount} has been received.`,
    tenantId: order.tenantId
  }, c.env)

  return c.redirect(`https://merchant.nepshop.com/orders/${orderId}?payment=success`)
})

app.get('/webhooks/esewa/failure', async (c) => {
  const orderId = c.req.query('oid')

  // Update order
  const db = await getTenantDatabase(tenantId, c.env)
  await db.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'failed'
    }
  })

  return c.redirect(`https://merchant.nepshop.com/orders/${orderId}?payment=failed`)
})

export { app as esewaRoutes }
```

**Client-Side (Next.js)**:

```typescript
'use client'

import { useState } from 'react'

export function CheckoutButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)

  const handlePayment = async () => {
    setLoading(true)

    try {
      const response = await fetch('/api/payment/esewa/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      })

      const { paymentUrl } = await response.json()

      // Redirect to eSewa
      window.location.href = paymentUrl
    } catch (error) {
      console.error('Payment initiation failed:', error)
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="bg-success-600 text-white px-6 py-3 rounded-lg"
    >
      {loading ? 'Processing...' : 'Pay with eSewa'}
    </button>
  )
}
```

---

### Khalti

**Digital wallet** - 3+ million users

#### API Costs

- **Integration Fee**: Rs 20,000 (one-time)
- **Transaction Fee**: 3.5% per transaction
- **Settlement**: T+3 days

#### Setup

```bash
# Contact Khalti
Email: merchant@khalti.com
Phone: +977-1-5970123
Website: https://khalti.com/join/merchant/

# Required documents (same as eSewa)
```

#### Integration

**Environment Variables**:

```bash
KHALTI_PUBLIC_KEY="test_public_key_dc74e0fd57cb46cd93832aee0a390234"
KHALTI_SECRET_KEY="test_secret_key_f59e8b7d18b4499ca40f68195a846335"
KHALTI_ENVIRONMENT="test"  # test or live
```

**Payment Initiation** (`src/services/payment/khalti.ts`):

```typescript
import { Env } from '../../index'

export async function initiateKhaltiPayment(
  orderId: string,
  amount: number,
  productName: string,
  env: Env
): Promise<{ pidx: string; payment_url: string }> {
  const response = await fetch('https://khalti.com/api/v2/epayment/initiate/', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${env.KHALTI_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      return_url: `${env.PLATFORM_URL}/webhooks/khalti/callback`,
      website_url: env.PLATFORM_URL,
      amount: amount * 100, // Convert to paisa
      purchase_order_id: orderId,
      purchase_order_name: productName,
      customer_info: {
        name: 'Customer Name',
        email: 'customer@example.com',
        phone: '9800000000'
      }
    })
  })

  const data = await response.json()

  return {
    pidx: data.pidx,
    payment_url: data.payment_url
  }
}

export async function verifyKhaltiPayment(
  pidx: string,
  env: Env
): Promise<any> {
  const response = await fetch('https://khalti.com/api/v2/epayment/lookup/', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${env.KHALTI_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pidx })
  })

  return await response.json()
}
```

**API Route**:

```typescript
app.post('/payment/khalti/initiate', async (c) => {
  const { orderId } = await c.req.json()
  const tenantId = c.get('tenantId')

  const db = await getTenantDatabase(tenantId, c.env)
  const order = await db.order.findUnique({
    where: { id: orderId }
  })

  const payment = await initiateKhaltiPayment(
    order.id,
    order.total,
    `Order #${order.orderNumber}`,
    c.env
  )

  await db.order.update({
    where: { id: orderId },
    data: {
      paymentGateway: 'khalti',
      paymentStatus: 'pending',
      paymentRefId: payment.pidx
    }
  })

  return c.json({ paymentUrl: payment.payment_url })
})

app.get('/webhooks/khalti/callback', async (c) => {
  const pidx = c.req.query('pidx')
  const orderId = c.req.query('purchase_order_id')

  // Verify payment
  const verification = await verifyKhaltiPayment(pidx, c.env)

  if (verification.status !== 'Completed') {
    return c.redirect(`/orders/${orderId}?payment=failed`)
  }

  // Update order
  const db = await getTenantDatabase(tenantId, c.env)
  await db.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'completed',
      paymentCompletedAt: new Date(),
      status: 'processing'
    }
  })

  return c.redirect(`/orders/${orderId}?payment=success`)
})
```

---

### IME Pay

**Bank-backed digital wallet** - 2+ million users

#### API Costs

- **Integration Fee**: Rs 15,000 (one-time)
- **Transaction Fee**: 2.5% per transaction
- **Settlement**: T+1 days

#### Integration

**Environment Variables**:

```bash
IMEPAY_MERCHANT_CODE="MERCHANT123"
IMEPAY_MERCHANT_NAME="NepShop"
IMEPAY_SECRET_KEY="your_secret_key"
IMEPAY_ENVIRONMENT="test"
```

**Payment Initiation** (`src/services/payment/imepay.ts`):

```typescript
import crypto from 'crypto'
import { Env } from '../../index'

export async function initiateIMEPayPayment(
  orderId: string,
  amount: number,
  env: Env
): Promise<{ transactionId: string; paymentUrl: string }> {
  const transactionId = `TXN${Date.now()}`

  // Generate checksum
  const message = `${env.IMEPAY_MERCHANT_CODE}|${transactionId}|${amount}|${env.IMEPAY_SECRET_KEY}`
  const checksum = crypto
    .createHash('sha256')
    .update(message)
    .digest('hex')

  const baseUrl = env.IMEPAY_ENVIRONMENT === 'production'
    ? 'https://payment.imepay.com.np'
    : 'https://stg.imepay.com.np'

  const paymentUrl = `${baseUrl}/WebCheckout/Checkout?` + new URLSearchParams({
    MerchantCode: env.IMEPAY_MERCHANT_CODE,
    RefId: transactionId,
    TranAmount: amount.toString(),
    Method: 'GET',
    ResponseUrl: `${env.PLATFORM_URL}/webhooks/imepay/callback`,
    CancelUrl: `${env.PLATFORM_URL}/webhooks/imepay/cancel`,
    CheckSum: checksum
  }).toString()

  return { transactionId, paymentUrl }
}
```

---

### ConnectIPS

**Inter-bank payment system** - Direct bank transfers

#### Overview

ConnectIPS connects all major Nepali banks (NIC Asia, Everest Bank, Global IME, etc.) for direct account-to-account transfers.

#### API Costs

- **Integration Fee**: Rs 30,000 (one-time)
- **Transaction Fee**: 1.5% (lower than wallets!)
- **Settlement**: T+1 days

#### Benefits

- **Lower fees** than digital wallets
- **Higher trust** (direct bank transfer)
- **No wallet balance** required

#### Integration

Contact **Fonepay** (ConnectIPS aggregator):
```
Email: info@fonepay.com
Phone: +977-1-5970200
```

**Implementation** (similar to other gateways):

```typescript
export async function initiateConnectIPSPayment(
  orderId: string,
  amount: number,
  env: Env
): Promise<{ paymentUrl: string }> {
  // Implementation via Fonepay API
  // Similar pattern to eSewa/Khalti
}
```

---

### FonePay

**Mobile banking aggregator**

#### Overview

FonePay integrates with 50+ banks and financial institutions in Nepal.

#### API Costs

- **Integration Fee**: Rs 25,000
- **Transaction Fee**: 2% + Rs 10
- **Settlement**: T+2 days

---

## Logistics & Delivery

### Pathao

**Leading logistics provider** in Nepal

#### Services

- **Parcel Delivery**: Within Kathmandu Valley (same-day/next-day)
- **Bike Delivery**: Small parcels (<5kg)
- **Car Delivery**: Large parcels
- **Coverage**: Kathmandu, Lalitpur, Bhaktapur, Pokhara

#### Pricing

- **Within Ring Road**: Rs 80-100
- **Outside Ring Road**: Rs 120-150
- **Pokhara**: Rs 150-200
- **Weight surcharge**: +Rs 20 per kg over 2kg

#### API Costs

- **Integration**: FREE
- **Per order fee**: Rs 0 (charged to customer)

#### Setup

```bash
# Contact Pathao
Email: merchant@pathao.com.np
Phone: +977-980-1111111
App: Download Pathao Business app

# Get API credentials
```

#### Integration

**Environment Variables**:

```bash
PATHAO_CLIENT_ID="your_client_id"
PATHAO_CLIENT_SECRET="your_client_secret"
PATHAO_USERNAME="merchant@example.com"
PATHAO_PASSWORD="your_password"
PATHAO_ENVIRONMENT="test"
```

**Authentication** (`src/services/logistics/pathao.ts`):

```typescript
import { Env } from '../../index'

interface PathaoAuth {
  access_token: string
  token_type: string
  expires_in: number
}

export async function getPathaoToken(env: Env): Promise<string> {
  // Check cache first
  const cached = await env.CACHE.get('pathao:token')
  if (cached) return cached

  // Get new token
  const baseUrl = env.PATHAO_ENVIRONMENT === 'production'
    ? 'https://merchant.pathao.com'
    : 'https://staging.pathao.com'

  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: env.PATHAO_CLIENT_ID,
      client_secret: env.PATHAO_CLIENT_SECRET,
      username: env.PATHAO_USERNAME,
      password: env.PATHAO_PASSWORD,
      grant_type: 'password'
    })
  })

  const auth: PathaoAuth = await response.json()

  // Cache for 50 minutes (expires in 60)
  await env.CACHE.put('pathao:token', auth.access_token, {
    expirationTtl: 50 * 60
  })

  return auth.access_token
}

export async function getPathaoAreas(env: Env): Promise<any[]> {
  const token = await getPathaoToken(env)

  const response = await fetch('https://merchant.pathao.com/api/v1/cities', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  })

  const data = await response.json()
  return data.data.data
}

export async function calculatePathaoPrice(
  storeId: number,
  recipientZone: number,
  itemType: number,
  env: Env
): Promise<number> {
  const token = await getPathaoToken(env)

  const response = await fetch('https://merchant.pathao.com/api/v1/merchant/price-plan', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      store_id: storeId,
      recipient_zone: recipientZone,
      item_type: itemType
    })
  })

  const data = await response.json()
  return data.data.price
}

export async function createPathaoOrder(
  orderDetails: {
    storeId: number
    recipientName: string
    recipientPhone: string
    recipientAddress: string
    recipientZone: number
    itemType: number
    itemQuantity: number
    itemWeight: number
    amountToCollect: number
    itemDescription: string
  },
  env: Env
): Promise<any> {
  const token = await getPathaoToken(env)

  const response = await fetch('https://merchant.pathao.com/api/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      store_id: orderDetails.storeId,
      merchant_order_id: `ORDER-${Date.now()}`,
      recipient_name: orderDetails.recipientName,
      recipient_phone: orderDetails.recipientPhone,
      recipient_address: orderDetails.recipientAddress,
      recipient_zone: orderDetails.recipientZone,
      item_type: orderDetails.itemType,
      item_quantity: orderDetails.itemQuantity,
      item_weight: orderDetails.itemWeight,
      amount_to_collect: orderDetails.amountToCollect,
      item_description: orderDetails.itemDescription
    })
  })

  return await response.json()
}
```

**API Route**:

```typescript
app.post('/api/shipping/pathao/calculate', async (c) => {
  const { zoneId, weight } = await c.req.json()
  const tenantId = c.get('tenantId')

  // Get merchant's Pathao store ID from database
  const db = await getTenantDatabase(tenantId, c.env)
  const settings = await db.tenantSettings.findUnique({
    where: { tenantId }
  })

  const price = await calculatePathaoPrice(
    settings.pathaoStoreId,
    zoneId,
    1, // Item type: parcel
    c.env
  )

  return c.json({ price })
})

app.post('/api/shipping/pathao/create', async (c) => {
  const { orderId } = await c.req.json()
  const tenantId = c.get('tenantId')

  const db = await getTenantDatabase(tenantId, c.env)
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { customer: true, shippingAddress: true }
  })

  const pathaoOrder = await createPathaoOrder({
    storeId: settings.pathaoStoreId,
    recipientName: order.customer.name,
    recipientPhone: order.customer.phone,
    recipientAddress: order.shippingAddress.fullAddress,
    recipientZone: order.shippingAddress.pathaoZoneId,
    itemType: 1,
    itemQuantity: order.items.length,
    itemWeight: order.totalWeight,
    amountToCollect: order.paymentMethod === 'cod' ? order.total : 0,
    itemDescription: `Order #${order.orderNumber}`
  }, c.env)

  // Update order with tracking
  await db.order.update({
    where: { id: orderId },
    data: {
      shippingProvider: 'pathao',
      trackingNumber: pathaoOrder.data.consignment_id,
      shippingStatus: 'pending_pickup'
    }
  })

  return c.json({ success: true, trackingNumber: pathaoOrder.data.consignment_id })
})
```

---

### Tootle

**Alternative logistics provider**

#### Services

- Similar to Pathao (bike/car delivery)
- Coverage: Kathmandu Valley

#### Pricing

- Slightly cheaper than Pathao (Rs 70-90 within Ring Road)

#### Integration

```bash
# Contact Tootle
Email: business@tootle.com.np
Website: https://tootle.com.np/business
```

**Implementation** (`src/services/logistics/tootle.ts`):

```typescript
export async function createTootleDelivery(
  orderDetails: {
    pickupAddress: string
    dropAddress: string
    recipientName: string
    recipientPhone: string
    packageValue: number
  },
  env: Env
): Promise<any> {
  const response = await fetch('https://api.tootle.com.np/v1/delivery', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.TOOTLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderDetails)
  })

  return await response.json()
}
```

---

## Communication

### Sparrow SMS

**Leading SMS gateway** in Nepal

#### Pricing

- **Per SMS**: Rs 0.95 - Rs 1.4 (depending on volume)
- **No setup fee**
- **Credits never expire**

#### Volume Pricing

| Monthly Volume | Price per SMS |
|----------------|---------------|
| 0 - 1,000 | Rs 1.40 |
| 1,000 - 10,000 | Rs 1.20 |
| 10,000 - 50,000 | Rs 1.00 |
| 50,000+ | Rs 0.95 |

#### Setup

```bash
# Sign up at: https://sparrowsms.com
# Purchase credits
# Get API token from dashboard
```

#### Integration

**Environment Variables**:

```bash
SPARROW_SMS_TOKEN="your_token_here"
SPARROW_SMS_FROM="NepShop"  # Sender ID (max 11 chars)
```

**SMS Service** (`src/services/sms/sparrow.ts`):

```typescript
import { Env } from '../../index'

export async function sendSMS(
  to: string,
  message: string,
  env: Env
): Promise<boolean> {
  // Format phone number (remove +977 if present)
  const phone = to.replace('+977', '')

  const response = await fetch('https://sms.aakashsms.com/sms/v3/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': env.SPARROW_SMS_TOKEN
    },
    body: JSON.stringify({
      from: env.SPARROW_SMS_FROM,
      to: phone,
      text: message
    })
  })

  const data = await response.json()

  return data.response_code === 200
}

export async function sendBulkSMS(
  recipients: Array<{ phone: string; message: string }>,
  env: Env
): Promise<void> {
  const promises = recipients.map(({ phone, message }) =>
    sendSMS(phone, message, env)
  )

  await Promise.all(promises)
}

export async function sendOTP(
  phone: string,
  otp: string,
  env: Env
): Promise<boolean> {
  const message = `Your OTP for NepShop is: ${otp}. Valid for 10 minutes. Do not share with anyone.`

  return await sendSMS(phone, message, env)
}

export async function sendOrderConfirmation(
  phone: string,
  orderNumber: string,
  total: number,
  env: Env
): Promise<boolean> {
  const message = `Your order #${orderNumber} is confirmed! Total: Rs ${total}. Track: https://nepshop.com/track/${orderNumber}`

  return await sendSMS(phone, message, env)
}

export async function sendShippingUpdate(
  phone: string,
  orderNumber: string,
  trackingNumber: string,
  env: Env
): Promise<boolean> {
  const message = `Your order #${orderNumber} has been shipped! Tracking: ${trackingNumber}`

  return await sendSMS(phone, message, env)
}
```

**Queue Consumer Integration** (`src/consumers/background-jobs.ts`):

```typescript
case 'sms':
  const sent = await sendSMS(job.to, job.message, env)

  if (!sent) {
    throw new Error('SMS sending failed')
  }

  // Log SMS in database (for billing)
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL })
  await db.smsLog.create({
    data: {
      tenantId: job.tenantId,
      recipient: job.to,
      message: job.message,
      status: 'sent',
      cost: 1.20, // Rs per SMS
      sentAt: new Date()
    }
  })

  break
```

**Usage in Application**:

```typescript
// Send OTP during signup
app.post('/auth/send-otp', async (c) => {
  const { phone } = await c.req.json()

  // Generate OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()

  // Store in KV (10 minute expiry)
  await c.env.TEMP.put(`otp:${phone}`, otp, {
    expirationTtl: 10 * 60
  })

  // Send via queue (async)
  await sendToQueue({
    type: 'sms',
    to: phone,
    message: `Your NepShop verification code is: ${otp}`,
    tenantId: 'platform'
  }, c.env)

  return c.json({ message: 'OTP sent' })
})
```

**Cost Tracking Dashboard**:

```typescript
// Get SMS usage for tenant
app.get('/api/billing/sms-usage', async (c) => {
  const tenantId = c.get('tenantId')

  const db = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL })

  const usage = await db.smsLog.aggregate({
    where: {
      tenantId,
      sentAt: {
        gte: new Date(new Date().setDate(1)) // This month
      }
    },
    _sum: {
      cost: true
    },
    _count: true
  })

  return c.json({
    totalSent: usage._count,
    totalCost: usage._sum.cost || 0
  })
})
```

---

## Localization

### Nepal Provinces & Districts

**Seed Data** (`packages/database/prisma/seeds/nepal-locations.ts`):

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const provinces = [
  { id: 1, name: 'Province No. 1', nameNepali: 'प्रदेश नं. १' },
  { id: 2, name: 'Madhesh Pradesh', nameNepali: 'मधेश प्रदेश' },
  { id: 3, name: 'Bagmati Pradesh', nameNepali: 'बागमती प्रदेश' },
  { id: 4, name: 'Gandaki Pradesh', nameNepali: 'गण्डकी प्रदेश' },
  { id: 5, name: 'Lumbini Pradesh', nameNepali: 'लुम्बिनी प्रदेश' },
  { id: 6, name: 'Karnali Pradesh', nameNepali: 'कर्णाली प्रदेश' },
  { id: 7, name: 'Sudurpashchim Pradesh', nameNepali: 'सुदूरपश्चिम प्रदेश' }
]

const districts = [
  // Province 1
  { provinceId: 1, name: 'Bhojpur', nameNepali: 'भोजपुर' },
  { provinceId: 1, name: 'Dhankuta', nameNepali: 'धनकुटा' },
  { provinceId: 1, name: 'Ilam', nameNepali: 'इलाम' },
  { provinceId: 1, name: 'Jhapa', nameNepali: 'झापा' },
  { provinceId: 1, name: 'Morang', nameNepali: 'मोरङ' },
  { provinceId: 1, name: 'Sunsari', nameNepali: 'सुनसरी' },

  // Bagmati Pradesh (Province 3)
  { provinceId: 3, name: 'Kathmandu', nameNepali: 'काठमाडौं' },
  { provinceId: 3, name: 'Lalitpur', nameNepali: 'ललितपुर' },
  { provinceId: 3, name: 'Bhaktapur', nameNepali: 'भक्तपुर' },
  { provinceId: 3, name: 'Kavrepalanchok', nameNepali: 'काभ्रेपलाञ्चोक' },
  { provinceId: 3, name: 'Chitwan', nameNepali: 'चितवन' },

  // ... all 77 districts
]

async function seedNepalLocations() {
  // Seed provinces
  for (const province of provinces) {
    await prisma.province.upsert({
      where: { id: province.id },
      update: province,
      create: province
    })
  }

  // Seed districts
  for (const district of districts) {
    await prisma.district.create({
      data: district
    })
  }

  console.log('Nepal locations seeded successfully')
}

seedNepalLocations()
```

### Nepali Language Support

**Translation Files** (`apps/web/locales/ne.json`):

```json
{
  "common": {
    "welcome": "स्वागत छ",
    "login": "लग इन",
    "signup": "साइन अप",
    "logout": "लग आउट",
    "save": "बचत गर्नुहोस्",
    "cancel": "रद्द गर्नुहोस्",
    "delete": "मेटाउनुहोस्",
    "edit": "सम्पादन गर्नुहोस्",
    "search": "खोज्नुहोस्"
  },
  "products": {
    "title": "उत्पादनहरू",
    "add": "उत्पादन थप्नुहोस्",
    "price": "मूल्य",
    "stock": "स्टक",
    "category": "श्रेणी"
  },
  "orders": {
    "title": "अर्डरहरू",
    "new": "नयाँ अर्डर",
    "pending": "पेन्डिङ",
    "confirmed": "पुष्टि भयो",
    "shipped": "पठाइयो",
    "delivered": "डेलिभर भयो"
  }
}
```

**i18n Setup** (`apps/web/lib/i18n.ts`):

```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import ne from '../locales/ne.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ne: { translation: ne }
    },
    lng: 'ne', // Default to Nepali
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
```

**Usage in Components**:

```typescript
import { useTranslation } from 'react-i18next'

export function ProductList() {
  const { t, i18n } = useTranslation()

  return (
    <div>
      <h1>{t('products.title')}</h1>
      <button onClick={() => i18n.changeLanguage('en')}>English</button>
      <button onClick={() => i18n.changeLanguage('ne')}>नेपाली</button>
    </div>
  )
}
```

**Number Formatting (Nepali)**:

```typescript
export function formatNepaliCurrency(amount: number): string {
  return new Intl.NumberFormat('ne-NP', {
    style: 'currency',
    currency: 'NPR',
    minimumFractionDigits: 2
  }).format(amount)
}

// Usage
formatNepaliCurrency(1999)
// Output: "रू १,९९९.००"
```

---

## Compliance

### E-Commerce Act 2025 (Nepal)

**Required Disclosures**:

1. **Company Registration**: Display registration number on footer
2. **Return Policy**: Clear 7-day return policy
3. **Privacy Policy**: GDPR-compliant data handling
4. **Terms of Service**: Legal terms and conditions
5. **Contact Information**: Physical address, email, phone

**Implementation** (`apps/storefront/app/layout.tsx`):

```typescript
export function Footer({ tenant }: { tenant: Tenant }) {
  return (
    <footer className="bg-neutral-900 text-white py-8">
      <div className="container mx-auto">
        <div className="grid grid-cols-4 gap-8">
          <div>
            <h3>Company</h3>
            <p>Reg. No: {tenant.companyRegNumber}</p>
            <p>PAN: {tenant.panNumber}</p>
            <p>{tenant.address}</p>
          </div>
          <div>
            <h3>Policies</h3>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/return-policy">Return Policy</Link>
          </div>
          <div>
            <h3>Contact</h3>
            <p>{tenant.email}</p>
            <p>{tenant.phone}</p>
          </div>
          <div>
            <h3>Payment Partners</h3>
            <img src="/esewa-logo.png" alt="eSewa" />
            <img src="/khalti-logo.png" alt="Khalti" />
          </div>
        </div>
      </div>
    </footer>
  )
}
```

---

**Last Updated**: October 7, 2025
**Version**: 1.0.0
