'use client'

import { createContext, useContext } from 'react'
import type { CartItemResource } from '../../types/cart'
import type { CartResource, CheckoutSessionResource } from '../../lib/cart-client'

export interface CartContextValue {
  cart: CartResource | null
  loading: boolean
  pending: boolean
  error: string | null
  open: boolean
  setOpen: (open: boolean) => void
  addItem: (payload: { productId: string; variantId?: string | null; quantity?: number }) => Promise<void>
  updateItem: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clearCart: () => Promise<void>
  beginCheckout: (payload: {
    email?: string | null
    phone?: string | null
    billingAddress?: Record<string, unknown> | null
    shippingAddress?: Record<string, unknown> | null
    shippingMethod?: Record<string, unknown> | null
    metadata?: Record<string, unknown> | null
  }) => Promise<CheckoutSessionResource>
}

export const CartContext = createContext<CartContextValue | undefined>(undefined)

export function useCart() {
  const value = useContext(CartContext)
  if (!value) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return value
}

export type CartItem = CartItemResource
