'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CartContext } from './CartContext'
import type { CartResource, CartResponse } from '../../lib/cart-client'
import {
  fetchCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
  readCachedCart,
  beginCheckout as beginCheckoutRequest
} from '../../lib/cart-client'
import CartDrawer from './CartDrawer'
import CartToggle from './CartToggle'

interface CartProviderProps {
  tenant: string
  children: ReactNode
}

export default function CartProvider({ tenant, children }: CartProviderProps) {
  const [cart, setCart] = useState<CartResource | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    const cached = readCachedCart()
    if (cached) {
      setCart(cached)
      setLoading(false)
    } else {
      setLoading(true)
    }

    ;(async () => {
      try {
        const result = await fetchCart(tenant)
        if (!cancelled) {
          setCart(result.data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled && !cached) {
          setError(err instanceof Error ? err.message : 'Failed to load cart')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tenant])

  const perform = useCallback(
    async (action: () => Promise<CartResponse>) => {
      setPending(true)
      try {
        const result = await action()
        setCart(result.data)
        setError(null)
        return result.data
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Cart action failed'
        setError(message)
        throw err
      } finally {
        setPending(false)
      }
    },
    []
  )

  const addItem = useCallback(
    async ({ productId, variantId = null, quantity = 1 }: { productId: string; variantId?: string | null; quantity?: number }) => {
      const result = await perform(() =>
        addCartItem(tenant, {
          productId,
          variantId,
          quantity,
          attributes: null
        })
      )
      if (result.items.length > 0) {
        setOpen(true)
      }
    },
    [perform, tenant]
  )

  const updateItem = useCallback(
    async (itemId: string, quantity: number) => {
      await perform(() =>
        updateCartItem(tenant, {
          itemId,
          quantity,
          attributes: null
        })
      )
    },
    [perform, tenant]
  )

  const removeItem = useCallback(
    async (itemId: string) => {
      await perform(() => removeCartItem(tenant, itemId))
    },
    [perform, tenant]
  )

  const clear = useCallback(async () => {
    await perform(() => clearCart(tenant))
  }, [perform, tenant])

  const beginCheckout = useCallback(
    async (payload: {
      email?: string | null
      phone?: string | null
      billingAddress?: Record<string, unknown> | null
      shippingAddress?: Record<string, unknown> | null
      shippingMethod?: Record<string, unknown> | null
    }) => {
      const session = await beginCheckoutRequest(tenant, payload)
      setCart(session.cart)
      return session
    },
    [tenant]
  )

  const value = useMemo(
    () => ({
      cart,
      loading,
      pending,
      error,
      open,
      setOpen,
      addItem,
      updateItem,
      removeItem,
      clearCart: clear,
      beginCheckout
    }),
    [cart, loading, pending, error, open, addItem, updateItem, removeItem, clear, beginCheckout]
  )

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartToggle />
      <CartDrawer />
    </CartContext.Provider>
  )
}
