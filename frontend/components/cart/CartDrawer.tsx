'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent
} from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useCart } from './CartContext'
import styles from './cart.module.css'

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function formatCurrency(amount: number, currency = 'NPR') {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency
  }).format(amount)
}

export default function CartDrawer() {
  const { cart, open, setOpen, pending, updateItem, removeItem, clearCart, error } = useCart()
  const router = useRouter()
  const params = useParams()
  const tenantSlug =
    typeof params?.tenant === 'string'
      ? params.tenant
      : Array.isArray(params?.tenant)
        ? params?.tenant[0]
        : ''

  const totals = useMemo(() => {
    if (!cart) {
      return { subtotal: 0, discount: 0, tax: 0, total: 0 }
    }
    return {
      subtotal: cart.subtotal,
      discount: cart.discountTotal,
      tax: cart.taxTotal,
      total: cart.total
    }
  }, [cart])

  const currency = cart?.currency ?? 'NPR'
  const breakdown = cart?.breakdown
  const shippingEstimate = breakdown?.shipping?.total ?? null

  const closeDrawer = useCallback(() => {
    setOpen(false)
  }, [setOpen])

  const handleQuantityChange = useCallback(
    (itemId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      const parsed = Number.parseInt(event.target.value, 10)
      const safeValue = Number.isNaN(parsed) || parsed < 1 ? 1 : parsed
      updateItem(itemId, safeValue)
    },
    [updateItem]
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDrawer()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, closeDrawer])

  const handleOverlayClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeDrawer()
    }
  }

  return (
    <>
      <div
        className={classNames(styles.cartOverlay, open && styles.cartOverlayOpen)}
        onClick={handleOverlayClick}
        aria-hidden={!open}
      />
      <aside
        className={classNames(styles.cartDrawer, open && styles.cartDrawerOpen)}
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
        id="cart-drawer"
      >
        <header className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>Your Cart</h2>
          <button type="button" onClick={closeDrawer} className={styles.drawerClose} aria-label="Close cart">
            ×
          </button>
        </header>

        <div className={styles.drawerBody}>
          {!cart || cart.items.length === 0 ? (
            <p className={styles.emptyState}>Your cart is empty. Explore the catalog to add products.</p>
          ) : (
            <ul className={styles.cartItems}>
              {cart.items.map((item) => (
                <li key={item.id} className={styles.cartItem}>
                  <div className={styles.itemHeader}>
                    <div>
                      <span className={styles.itemTitle}>{item.title ?? 'Product'}</span>
                      <p className={styles.itemSku}>{item.sku ?? 'SKU not provided'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={pending}
                      className={styles.removeButton}
                    >
                      Remove
                    </button>
                  </div>
                  <div className={styles.itemControls}>
                    <label style={{ fontSize: '0.85rem', color: '#475569' }}>
                      Qty
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={handleQuantityChange(item.id)}
                        disabled={pending}
                        className={styles.quantityInput}
                        aria-label={`Quantity for ${item.title ?? 'item'}`}
                      />
                    </label>
                    <span className={styles.lineSubtotal}>{formatCurrency(item.subtotal, currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className={styles.drawerFooter}>
          {error ? <p className={styles.drawerError}>{error}</p> : null}
          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal, currency)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Discounts</span>
            <span>-{formatCurrency(totals.discount, currency)}</span>
          </div>
          {breakdown ? (
            <div className={styles.discountBreakdown}>
              {breakdown.discounts.lineItems > 0 ? (
                <span>• Line items: -{formatCurrency(breakdown.discounts.lineItems, currency)}</span>
              ) : null}
              {breakdown.discounts.order > 0 ? (
                <span>• Order promos: -{formatCurrency(breakdown.discounts.order, currency)}</span>
              ) : null}
              {breakdown.discounts.giftCards > 0 ? (
                <span>• Gift cards: -{formatCurrency(breakdown.discounts.giftCards, currency)}</span>
              ) : null}
              {breakdown.shipping?.discount && breakdown.shipping.discount > 0 ? (
                <span>
                  • Shipping discount: -{formatCurrency(breakdown.shipping.discount, currency)}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className={styles.summaryRow}>
            <span>Shipping</span>
            {shippingEstimate && shippingEstimate > 0 ? (
              <span>{formatCurrency(shippingEstimate, currency)}</span>
            ) : (
              <span className={styles.muted}>Calculated at checkout</span>
            )}
          </div>
          <div className={styles.summaryRow}>
            <span>Tax</span>
            <span>{formatCurrency(totals.tax, currency)}</span>
          </div>
          <div className={classNames(styles.summaryRow, styles.summaryRowTotal)}>
            <span>Total</span>
            <span>{formatCurrency(totals.total, currency)}</span>
          </div>
          <button
            type="button"
            onClick={() => clearCart()}
            disabled={pending || !cart || cart.items.length === 0}
            className={classNames(styles.drawerButton, styles.drawerButtonSecondary)}
          >
            Clear cart
          </button>
          <button
            type="button"
            disabled={pending || !cart || cart.items.length === 0}
            onClick={() => {
              if (!cart || cart.items.length === 0 || !tenantSlug) return
              closeDrawer()
              router.push(`/${tenantSlug}/checkout`)
            }}
            className={classNames(styles.drawerButton, styles.drawerButtonPrimary)}
          >
            Go to checkout
          </button>
        </footer>
      </aside>
    </>
  )
}
