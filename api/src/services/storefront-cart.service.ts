import { HTTPException } from 'hono/http-exception'
import { Prisma } from '@prisma/client'
import type { EnvBindings, AuthUser } from '../types'
import { getPrisma } from '../lib/prisma'
import { logToBetterStack } from '../lib/logging'
import { capturePosthogEvent } from '../lib/posthog'
import { assertRateLimit } from '../lib/rate-limit'
import {
  addItemToCart,
  clearCart,
  getCartBySession,
  removeCartItem,
  updateCartItem,
  createCartSession
} from './cart.service'
import type { CartResource } from './cart.service'
import type { CheckoutSessionResource } from './checkout.service'
import {
  createCheckoutSession,
  getCheckoutSession,
  confirmCheckoutSession,
  submitCheckoutSession
} from './checkout.service'

interface EnsureSessionResult {
  token: string
  cart: CartResource
}

async function resolveTenantId(env: EnvBindings, tenantSlug: string) {
  const prisma = getPrisma(env)
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, currency: true }
  })

  if (!tenant) {
    throw new HTTPException(404, { message: 'Tenant not found' })
  }

  return tenant.id
}

export async function ensureStorefrontCartSession(
  env: EnvBindings,
  tenantSlug: string,
  sessionToken?: string | null
): Promise<EnsureSessionResult> {
  const tenantId = await resolveTenantId(env, tenantSlug)

  if (sessionToken) {
    try {
      const cart = await getCartBySession(env, tenantId, sessionToken)
      return { token: sessionToken, cart }
    } catch (error) {
      if (error instanceof HTTPException && error.status === 404) {
        // fall through to create new session
      } else {
        throw error
      }
    }
  }

  const { session, cart } = await createCartSession(env, tenantId, {
    currency: undefined,
    locale: undefined,
    email: undefined,
    phone: undefined,
    metadata: null
  })

  return { token: session.token, cart }
}

export async function addItemForStorefront(
  env: EnvBindings,
  tenantSlug: string,
  sessionToken: string,
  payload: { productId: string; variantId?: string | null; quantity: number; attributes?: Record<string, unknown> | null }
) {
  const tenantId = await resolveTenantId(env, tenantSlug)

  return addItemToCart(env, tenantId, {
    sessionToken,
    productId: payload.productId,
    variantId: payload.variantId ?? null,
    quantity: payload.quantity,
    attributes: (payload.attributes ?? null) as any
  })
}

export async function updateItemForStorefront(
  env: EnvBindings,
  tenantSlug: string,
  sessionToken: string,
  payload: { itemId: string; quantity: number; attributes?: Record<string, unknown> | null }
) {
  const tenantId = await resolveTenantId(env, tenantSlug)

  return updateCartItem(env, tenantId, {
    sessionToken,
    itemId: payload.itemId,
    quantity: payload.quantity,
    attributes: (payload.attributes ?? null) as any
  })
}

export async function removeItemForStorefront(
  env: EnvBindings,
  tenantSlug: string,
  sessionToken: string,
  itemId: string
) {
  const tenantId = await resolveTenantId(env, tenantSlug)

  return removeCartItem(env, tenantId, {
    sessionToken,
    itemId
  })
}

export async function clearStorefrontCart(env: EnvBindings, tenantSlug: string, sessionToken: string) {
  const tenantId = await resolveTenantId(env, tenantSlug)

  return clearCart(env, tenantId, {
    sessionToken
  })
}

interface StorefrontCheckoutInput {
  email?: string | null
  phone?: string | null
  billingAddress?: Record<string, unknown> | null
  shippingAddress?: Record<string, unknown> | null
  shippingMethod?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export async function beginStorefrontCheckout(
  env: EnvBindings,
  tenantSlug: string,
  sessionToken: string,
  input: StorefrontCheckoutInput
): Promise<CheckoutSessionResource> {
  const tenantId = await resolveTenantId(env, tenantSlug)
  const cart = await getCartBySession(env, tenantId, sessionToken)

  if (!cart || cart.items.length === 0) {
    throw new HTTPException(400, { message: 'Cart is empty' })
  }

  const authUser: AuthUser = {
    tenantId,
    userId: `storefront-${tenantId}`,
    email: input.email ?? 'checkout@storefront.local',
    role: 'OWNER'
  }

  const session = await createCheckoutSession(env, authUser, {
    cartId: cart.id,
    email: input.email ?? undefined,
    phone: input.phone ?? undefined,
    billingAddress: (input.billingAddress ?? null) as Prisma.InputJsonValue | null,
    shippingAddress: (input.shippingAddress ?? null) as Prisma.InputJsonValue | null,
    shippingMethod: (input.shippingMethod ?? null) as Prisma.InputJsonValue | null,
    metadata: (input.metadata ?? null) as Prisma.InputJsonValue | null
  })

  await logToBetterStack(env, {
    level: 'info',
    event: 'storefront.checkout.started',
    tenantId,
    tenantSlug,
    checkoutSessionId: session.id,
    cartId: cart.id,
    currency: session.currency,
    cartTotal: cart.total,
    itemCount: cart.items.length,
    emailProvided: Boolean(input.email),
    hasShippingAddress: Boolean(input.shippingAddress)
  })

  await capturePosthogEvent(
    env,
    'storefront_checkout_started',
    {
      tenantId,
      tenantSlug,
      checkoutSessionId: session.id,
      cartId: cart.id,
      total: session.total,
      currency: session.currency,
      itemCount: cart.items.length,
      emailProvided: Boolean(input.email),
      hasShippingAddress: Boolean(input.shippingAddress)
    },
    { distinctId: session.id }
  )

  return session
}

export async function getStorefrontCheckoutSession(
  env: EnvBindings,
  tenantSlug: string,
  sessionToken: string,
  sessionId: string
): Promise<CheckoutSessionResource> {
  const tenantId = await resolveTenantId(env, tenantSlug)
  const cart = await getCartBySession(env, tenantId, sessionToken)

  const authUser: AuthUser = {
    tenantId,
    userId: `storefront-${tenantId}`,
    email: 'checkout@storefront.local',
    role: 'OWNER'
  }

  const session = await getCheckoutSession(env, authUser, sessionId)

  if (session.cart.id !== cart.id) {
    throw new HTTPException(403, { message: 'Checkout session does not belong to this cart' })
  }

  return session
}

export async function confirmStorefrontCheckout(
  env: EnvBindings,
  tenantSlug: string,
  sessionToken: string,
  sessionId: string
): Promise<CheckoutSessionResource> {
  const tenantId = await resolveTenantId(env, tenantSlug)
  const cart = await getCartBySession(env, tenantId, sessionToken)
  await assertRateLimit(env, `checkout:confirm:${tenantId}:${sessionId}`, 5, 60)
  const authUser: AuthUser = {
    tenantId,
    userId: `storefront-${tenantId}`,
    email: 'checkout@storefront.local',
    role: 'OWNER'
  }

  const session = await confirmCheckoutSession(env, authUser, sessionId)
  if (session.cart.id !== cart.id) {
    throw new HTTPException(403, { message: 'Checkout session does not belong to this cart' })
  }

  if (session.status === 'CONFIRMED') {
    await getPrisma(env).auditLog.create({
      data: {
        tenantId,
        action: 'storefront.checkout.confirmed',
        metadata: {
          checkoutSessionId: session.id,
          cartId: cart.id,
          tenantSlug,
          channel: 'storefront'
        }
      }
    })
  }

  await logToBetterStack(env, {
    level: 'info',
    event: 'storefront.checkout.confirmed',
    tenantId,
    tenantSlug,
    checkoutSessionId: session.id,
    cartId: cart.id,
    checkoutStatus: session.status,
    total: session.total
  })

  await capturePosthogEvent(
    env,
    'storefront_checkout_confirmed',
    {
      tenantId,
      tenantSlug,
      checkoutSessionId: session.id,
      cartId: cart.id,
      status: session.status,
      total: session.total,
      confirmedAt: session.confirmedAt ? session.confirmedAt.toISOString() : null
    },
    { distinctId: session.id }
  )

  return session
}

export async function submitStorefrontCheckout(
  env: EnvBindings,
  tenantSlug: string,
  sessionToken: string,
  sessionId: string,
  paymentMethod?: string | null
): Promise<{ orderId: string | null; checkoutSessionId: string }> {
  const tenantId = await resolveTenantId(env, tenantSlug)
  const cart = await getCartBySession(env, tenantId, sessionToken)
  await assertRateLimit(env, `checkout:submit:${tenantId}:${sessionId}`, 5, 60)
  const authUser: AuthUser = {
    tenantId,
    userId: `storefront-${tenantId}`,
    email: 'checkout@storefront.local',
    role: 'OWNER'
  }

  const result = await submitCheckoutSession(env, authUser, sessionId, {
    paymentMethod: paymentMethod ?? undefined
  })

  const session = await getCheckoutSession(env, authUser, sessionId)
  if (session.cart.id !== cart.id) {
    throw new HTTPException(403, { message: 'Checkout session does not belong to this cart' })
  }

  if (result.orderId) {
    await getPrisma(env).auditLog.create({
      data: {
        tenantId,
        action: 'storefront.checkout.submitted',
        metadata: {
          checkoutSessionId: session.id,
          cartId: cart.id,
          orderId: result.orderId,
          tenantSlug,
          paymentMethod: paymentMethod ?? null,
          channel: 'storefront'
        }
      }
    })
  }

  await logToBetterStack(env, {
    level: 'info',
    event: 'storefront.checkout.submitted',
    tenantId,
    tenantSlug,
    checkoutSessionId: session.id,
    cartId: cart.id,
    orderId: result.orderId,
    paymentMethod: paymentMethod ?? undefined,
    total: session.total
  })

  await capturePosthogEvent(
    env,
    'storefront_checkout_submitted',
    {
      tenantId,
      tenantSlug,
      checkoutSessionId: session.id,
      cartId: cart.id,
      orderId: result.orderId,
      paymentMethod: paymentMethod ?? undefined,
      total: session.total,
      submittedAt: session.submittedAt ? session.submittedAt.toISOString() : null
    },
    { distinctId: session.id }
  )

  return result
}
