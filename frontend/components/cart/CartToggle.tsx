'use client'

import { useMemo } from 'react'
import { useCart } from './CartContext'
import styles from './cart.module.css'

export default function CartToggle() {
  const { cart, open, setOpen, loading, pending } = useCart()
  const count = useMemo(() => cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0, [cart])

  const label = `Cart${count > 0 ? ` (${count})` : ''}`

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      disabled={loading && !cart}
      className={styles.toggleButton}
      aria-label={label}
      aria-expanded={open}
      aria-controls="cart-drawer"
    >
      {label}
      {count > 0 ? <span className={styles.toggleBadge}>{count}</span> : null}
      {pending ? <span className={styles.loadingSpinner} aria-hidden /> : null}
    </button>
  )
}
