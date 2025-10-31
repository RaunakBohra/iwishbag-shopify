'use client'

import { useMemo, useState } from 'react'
import { useCart } from './CartContext'

interface AddToCartButtonProps {
  productId: string
  variantId?: string | null
  quantity?: number
  disabled?: boolean
  className?: string
  label?: string
  pendingLabel?: string
  outOfStockLabel?: string
}

function baseButtonStyles(disabled: boolean) {
  return {
    border: 'none',
    borderRadius: '999px',
    padding: '0.75rem 1.35rem',
    background: disabled ? '#cbd5f5' : '#22d3ee',
    color: disabled ? '#64748b' : '#0f172a',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: disabled ? 'none' : '0 12px 30px rgba(34, 211, 238, 0.3)'
  } as const
}

export default function AddToCartButton({
  productId,
  variantId = null,
  quantity = 1,
  disabled = false,
  className,
  label = 'Add to cart',
  pendingLabel = 'Adding…',
  outOfStockLabel = 'Out of stock'
}: AddToCartButtonProps) {
  const { addItem, pending, error } = useCart()
  const [localPending, setLocalPending] = useState(false)
  const isDisabled = disabled || pending || localPending
  const buttonLabel = useMemo(() => {
    if (disabled) return outOfStockLabel
    if (pending || localPending) return pendingLabel
    return label
  }, [disabled, pending, localPending, outOfStockLabel, pendingLabel, label])

  const handleClick = async () => {
    if (isDisabled) {
      return
    }
    setLocalPending(true)
    try {
      await addItem({ productId, variantId, quantity })
    } catch (err) {
      console.error('Failed to add item to cart', err)
    } finally {
      setLocalPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        className={className}
        style={className ? undefined : baseButtonStyles(isDisabled)}
        aria-live="polite"
      >
        {buttonLabel}
      </button>
      {error ? (
        <p
          style={{
            color: '#dc2626',
            fontSize: '0.8rem',
            marginTop: '0.35rem'
          }}
          role="status"
          aria-live="polite"
        >
          {error}
        </p>
      ) : null}
    </>
  )
}
