'use client'

import { useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useCart } from './CartContext'

function formatCurrency(amount: number, currency = 'NPR') {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency
  }).format(amount)
}

export default function CartDrawer() {
  const { cart, open, setOpen, pending, updateItem, removeItem, clearCart } = useCart()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = typeof params?.tenant === 'string' ? params.tenant : Array.isArray(params?.tenant) ? params?.tenant[0] : ''

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

  return (
    <div
      className="cart-drawer"
      data-open={open}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(380px, 90vw)',
        transform: open ? 'translateX(0)' : 'translateX(105%)',
        transition: 'transform 0.25s ease-in-out',
        background: '#fff',
        boxShadow: '-12px 0 45px rgba(15, 23, 42, 0.12)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 2000
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Your Cart</h2>
        <button type="button" onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem' }}>
          ×
        </button>
      </header>
      <div style={{ flex: '1 1 auto', overflowY: 'auto', paddingRight: '0.5rem' }}>
        {!cart || cart.items.length === 0 ? (
          <p style={{ color: '#64748b' }}>Your cart is empty. Add a product to get started.</p>
        ) : (
          <ul style={{ display: 'grid', gap: '1rem' }}>
            {cart.items.map((item) => (
              <li
                key={item.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '1rem',
                  padding: '1rem',
                  display: 'grid',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <strong>{item.title ?? 'Product'}</strong>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>{item.sku ?? 'SKU'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={pending}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      fontSize: '0.875rem'
                    }}
                  >
                    Remove
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <label style={{ fontSize: '0.875rem', color: '#475569' }}>
                    Qty
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => updateItem(item.id, Number(event.target.value))}
                      disabled={pending}
                      style={{
                        marginLeft: '0.5rem',
                        width: '4rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #cbd5f5'
                      }}
                    />
                  </label>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(item.subtotal, cart?.currency)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <footer style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'grid', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
          <span>Subtotal</span>
          <span>{formatCurrency(totals.subtotal, cart?.currency)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
          <span>Discount</span>
          <span>-{formatCurrency(totals.discount, cart?.currency)}</span>
        </div>
        {cart?.breakdown ? (
          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'grid', gap: '0.15rem' }}>
            {cart.breakdown.discounts.lineItems > 0 ? (
              <span>
                • Line items: -{formatCurrency(cart.breakdown.discounts.lineItems, cart.currency)}
              </span>
            ) : null}
            {cart.breakdown.discounts.order > 0 ? (
              <span>
                • Order promos: -{formatCurrency(cart.breakdown.discounts.order, cart.currency)}
              </span>
            ) : null}
            {cart.breakdown.discounts.giftCards > 0 ? (
              <span>
                • Gift cards: -{formatCurrency(cart.breakdown.discounts.giftCards, cart.currency)}
              </span>
            ) : null}
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
          <span>Tax</span>
          <span>{formatCurrency(totals.tax, cart?.currency)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>Total</span>
          <span>{formatCurrency(totals.total, cart?.currency)}</span>
        </div>
        <button
          type="button"
          onClick={() => clearCart()}
          disabled={pending || !cart || cart.items.length === 0}
          style={{
            border: '1px solid #94a3b8',
            borderRadius: '999px',
            padding: '0.75rem 1rem',
            background: 'transparent',
            color: '#475569'
          }}
        >
          Clear cart
        </button>
        <button
          type="button"
          disabled={pending || !cart || cart.items.length === 0}
          onClick={() => {
            if (!cart || cart.items.length === 0) return
            if (tenantSlug) {
              setOpen(false)
              router.push(`/${tenantSlug}/checkout`)
            }
          }}
          style={{
            border: 'none',
            borderRadius: '999px',
            padding: '0.85rem 1rem',
            background: pending || !cart || cart.items.length === 0 ? '#94a3b8' : '#0ea5e9',
            color: '#fff',
            fontWeight: 600,
            cursor: pending || !cart || cart.items.length === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          Go to checkout
        </button>
      </footer>
    </div>
  )
}
