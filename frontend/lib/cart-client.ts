'use client'

import type { CartItemResource } from '../types/cart'

export interface CartPricingBreakdownResource {
  discounts: {
    lineItems: number
    order: number
    giftCards: number
    total: number
  }
  shipping: {
    total: number
    original: number | null
    discount: number
  }
  tax: {
    rate: number
  }
}

export interface CartResource {
  id: string
  currency: string
  locale: string | null
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  items: CartItemResource[]
  breakdown?: CartPricingBreakdownResource
}

export interface CartResponse {
  data: CartResource
  token: string
  signedToken?: string
}

export interface CheckoutSessionResource {
  id: string
  status: string
  currency: string
  locale: string | null
  email: string | null
  phone: string | null
  subtotal: number
  discountTotal: number
  taxTotal: number
  shippingTotal: number
  total: number
  paymentMethod: string | null
  shippingMethod: Record<string, unknown> | null
  billingAddress: Record<string, unknown> | null
  shippingAddress: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  expiresAt: string | null
  confirmedAt: string | null
  submittedAt: string | null
  failedAt: string | null
  orderId: string | null
  breakdown?: CartPricingBreakdownResource
  cart: CartResource
}

export interface CheckoutResponse {
  data: CheckoutSessionResource
  token: string
  signedToken?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL
const TOKEN_STORAGE_KEY = 'storefront.cart.token'
const CART_STORAGE_KEY = 'storefront.cart.cache'
const CHECKOUT_SESSION_KEY = 'storefront.checkout.session'

let cachedSignedToken: string | null = null

function readStoredToken() {
  if (cachedSignedToken) {
    return cachedSignedToken
  }
  if (typeof window === 'undefined') {
    return null
  }
  try {
    cachedSignedToken = window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to read cart token from storage', error)
    cachedSignedToken = null
  }
  return cachedSignedToken
}

function persistToken(token: string | null | undefined) {
  if (token === null || token === undefined || token === '') {
    cachedSignedToken = null
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.removeItem(TOKEN_STORAGE_KEY)
      } catch (error) {
        console.warn('Failed to clear cart token from storage', error)
      }
    }
    return
  }

  cachedSignedToken = token
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
    } catch (error) {
      console.warn('Failed to persist cart token', error)
    }
  }
}

function persistCartCache(cart: CartResource | null) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    if (!cart) {
      window.sessionStorage.removeItem(CART_STORAGE_KEY)
      return
    }
    window.sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  } catch (error) {
    console.warn('Failed to persist cart cache', error)
  }
}

export function readCachedCart(): CartResource | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(CART_STORAGE_KEY)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as CartResource
  } catch (error) {
    console.warn('Failed to read cached cart', error)
    return null
  }
}

function persistLastCheckoutSessionId(id: string | null | undefined) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    if (!id) {
      window.sessionStorage.removeItem(CHECKOUT_SESSION_KEY)
    } else {
      window.sessionStorage.setItem(CHECKOUT_SESSION_KEY, id)
    }
  } catch (error) {
    console.warn('Failed to persist checkout session id', error)
  }
}

export function readLastCheckoutSessionId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.sessionStorage.getItem(CHECKOUT_SESSION_KEY)
  } catch (error) {
    console.warn('Failed to read checkout session id', error)
    return null
  }
}

function getApiBase() {
  if (!API_BASE) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured')
  }
  return API_BASE.replace(/\/$/, '')
}

async function request<T extends { signedToken?: string }>(tenant: string, path: string, options: RequestInit = {}): Promise<T> {
  const base = getApiBase()
  const headers = new Headers(options.headers ?? {})
  headers.set('Content-Type', 'application/json')

  const sessionToken = readStoredToken()
  if (sessionToken) {
    headers.set('x-cart-session', sessionToken)
  }

  const response = await fetch(`${base}/public/v1/storefront/${tenant}${path}`, {
    ...options,
    credentials: 'include',
    headers
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed (${response.status})`)
  }

  const body = (await response.json()) as T
  return body
}

export async function fetchCart(tenant: string): Promise<CartResponse> {
  const result = await request<CartResponse>(tenant, '/cart', { method: 'GET' })
  persistToken(result.signedToken)
  persistCartCache(result.data)
  return result
}

export async function addCartItem(
  tenant: string,
  payload: { productId: string; variantId?: string | null; quantity: number; attributes?: Record<string, unknown> | null }
): Promise<CartResponse> {
  const result = await request<CartResponse>(tenant, '/cart/items', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  persistToken(result.signedToken)
  persistCartCache(result.data)
  return result
}

export async function updateCartItem(
  tenant: string,
  payload: { itemId: string; quantity: number; attributes?: Record<string, unknown> | null }
): Promise<CartResponse> {
  const result = await request<CartResponse>(tenant, '/cart/items', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
  persistToken(result.signedToken)
  persistCartCache(result.data)
  return result
}

export async function removeCartItem(tenant: string, itemId: string): Promise<CartResponse> {
  const result = await request<CartResponse>(tenant, `/cart/items/${itemId}`, { method: 'DELETE' })
  persistToken(result.signedToken)
  persistCartCache(result.data)
  return result
}

export async function clearCart(tenant: string): Promise<CartResponse> {
  const result = await request<CartResponse>(tenant, '/cart/clear', { method: 'POST' })
  persistToken(result.signedToken)
  persistCartCache(result.data)
  return result
}

export async function beginCheckout(
  tenant: string,
  payload: {
    email?: string | null
    phone?: string | null
    billingAddress?: Record<string, unknown> | null
    shippingAddress?: Record<string, unknown> | null
    shippingMethod?: Record<string, unknown> | null
    metadata?: Record<string, unknown> | null
  }
): Promise<CheckoutSessionResource> {
  const result = await request<CheckoutResponse>(tenant, '/cart/checkout', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  persistToken(result.signedToken)
  persistLastCheckoutSessionId(result.data.id)
  return result.data
}

export async function fetchCheckoutSession(tenant: string, sessionId: string): Promise<CheckoutSessionResource> {
  const result = await request<CheckoutResponse>(tenant, `/cart/checkout/${sessionId}`, {
    method: 'GET'
  })
  persistToken(result.signedToken)
  persistCartCache(result.data.cart)
  persistLastCheckoutSessionId(result.data.id)
  return result.data
}

export async function confirmCheckoutSession(tenant: string, sessionId: string): Promise<CheckoutSessionResource> {
  const result = await request<CheckoutResponse>(tenant, `/cart/checkout/${sessionId}/confirm`, {
    method: 'POST'
  })
  persistToken(result.signedToken)
  persistCartCache(result.data.cart)
  persistLastCheckoutSessionId(result.data.id)
  return result.data
}

export async function submitCheckoutSession(tenant: string, sessionId: string, paymentMethod?: string | null): Promise<{ orderId: string | null; checkoutSessionId: string }> {
  const result = await request<{ data: { orderId: string | null; checkoutSessionId: string }; token: string; signedToken?: string }>(
    tenant,
    `/cart/checkout/${sessionId}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({ paymentMethod })
    }
  )
  persistToken(result.signedToken)
  persistLastCheckoutSessionId(result.data.checkoutSessionId)
  return result.data
}
