'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { CheckoutSessionResource } from '../../../../../lib/cart-client'
import {
  fetchCheckoutSession,
  confirmCheckoutSession,
  submitCheckoutSession,
  readLastCheckoutSessionId
} from '../../../../../lib/cart-client'

const POLL_INTERVAL_MS = 5000

function formatCurrency(amount: number, currency = 'NPR') {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency
  }).format(amount)
}

export default function CheckoutConfirmationPage() {
  const params = useParams()
  const router = useRouter()
  const tenantSlug = typeof params?.tenant === 'string' ? params.tenant : Array.isArray(params?.tenant) ? params?.tenant[0] : ''
  const sessionId = typeof params?.sessionId === 'string' ? params.sessionId : Array.isArray(params?.sessionId) ? params?.sessionId[0] : ''

  const [session, setSession] = useState<CheckoutSessionResource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    let active = true
    let timeout: ReturnType<typeof setTimeout> | null = null

    const load = async () => {
      if (!tenantSlug || !sessionId) return

      try {
        const result = await fetchCheckoutSession(tenantSlug, sessionId)
        if (!active) {
          return
        }
        setSession(result)
        setError(null)

        if (result.status === 'SUBMITTED' || result.status === 'FAILED') {
          setPolling(false)
          return
        }

        setPolling(true)
        timeout = setTimeout(load, POLL_INTERVAL_MS)
      } catch (err) {
        if (!active) {
          return
        }
        setError(err instanceof Error ? err.message : 'Unable to load checkout session')
        setPolling(true)
        timeout = setTimeout(load, POLL_INTERVAL_MS)
      }
    }

    const storedSessionId = readLastCheckoutSessionId()
    if (!sessionId && storedSessionId) {
      router.replace(`/${tenantSlug}/checkout/confirmation/${storedSessionId}`)
    } else if (sessionId) {
      load()
    }

    return () => {
      active = false
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [tenantSlug, sessionId, router])

  const summary = useMemo(() => {
    if (!session) {
      return null
    }

    return {
      subtotal: session.subtotal,
      discountTotal: session.discountTotal,
      taxTotal: session.taxTotal,
      shippingTotal: session.shippingTotal,
      total: session.total,
      breakdown: session.breakdown,
      currency: session.currency
    }
  }, [session])

  const statusMessage = useMemo(() => {
    if (!session) {
      return 'Preparing checkout session…'
    }

    switch (session.status) {
      case 'INITIATED':
        return 'Checkout session created. Please continue to payment.'
      case 'PREVIEWED':
        return 'Shipping and totals calculated. Confirm to proceed to payment.'
      case 'CONFIRMED':
        return 'Checkout confirmed. Awaiting payment submission.'
      case 'SUBMITTED':
        return 'Order submitted successfully!'
      case 'FAILED':
        return 'Checkout failed. Please try again.'
      default:
        return `Checkout status: ${session.status}`
    }
  }, [session])

  if (!tenantSlug) {
    return null
  }

  const paymentMethod = (session?.metadata as Record<string, unknown> | null | undefined)?.paymentMethod

  const handleCompletePayment = async () => {
    if (!tenantSlug || !sessionId) return
    setProcessing(true)
    setError(null)
    try {
      let updatedSession = session
      if (!updatedSession || (updatedSession.status !== 'CONFIRMED' && updatedSession.status !== 'SUBMITTED')) {
        updatedSession = await confirmCheckoutSession(tenantSlug, sessionId)
        setSession(updatedSession)
      }

      if (updatedSession.status !== 'SUBMITTED') {
        await submitCheckoutSession(tenantSlug, sessionId, typeof paymentMethod === 'string' ? paymentMethod : 'cod')
        const refreshed = await fetchCheckoutSession(tenantSlug, sessionId)
        setSession(refreshed)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete payment')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '1.5rem' }}>
      <button
        type="button"
        onClick={() => router.push(`/${tenantSlug}/products`)}
        style={{
          border: 'none',
          background: 'transparent',
          color: '#0ea5e9',
          marginBottom: '1rem',
          cursor: 'pointer'
        }}
      >
        ← Continue shopping
      </button>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Checkout status</h1>
      <p style={{ color: '#475569', marginBottom: '1.5rem' }}>{statusMessage}</p>
      {polling ? <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Refreshing every 5 seconds…</p> : null}
      {error ? <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p> : null}

      {session && summary ? (
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <section style={{ background: '#f8fafc', borderRadius: '1.5rem', padding: '1.5rem', display: 'grid', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Order summary</h2>
            {typeof paymentMethod === 'string' ? (
              <p style={{ fontSize: '0.9rem', color: '#475569' }}>Payment method: {paymentMethod === 'cod' ? 'Cash on delivery' : paymentMethod}</p>
            ) : null}
            <ul style={{ display: 'grid', gap: '0.75rem' }}>
              {session.cart.items.map((item) => (
                <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                  <span>
                    {item.title ?? 'Product'} × {item.quantity}
                  </span>
                  <span>{formatCurrency(item.subtotal, summary.currency)}</span>
                </li>
              ))}
            </ul>
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'grid', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Subtotal</span>
                <span>{formatCurrency(summary.subtotal, summary.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Discounts</span>
                <span>-{formatCurrency(summary.discountTotal, summary.currency)}</span>
              </div>
              {summary.breakdown ? (
                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'grid', gap: '0.15rem' }}>
                  {summary.breakdown.discounts.lineItems > 0 ? (
                    <span>
                      • Line items: -{formatCurrency(summary.breakdown.discounts.lineItems, summary.currency)}
                    </span>
                  ) : null}
                  {summary.breakdown.discounts.order > 0 ? (
                    <span>
                      • Order promos: -{formatCurrency(summary.breakdown.discounts.order, summary.currency)}
                    </span>
                  ) : null}
                  {summary.breakdown.discounts.giftCards > 0 ? (
                    <span>
                      • Gift cards: -{formatCurrency(summary.breakdown.discounts.giftCards, summary.currency)}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Shipping</span>
                <span>{formatCurrency(summary.shippingTotal, summary.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Tax</span>
                <span>{formatCurrency(summary.taxTotal, summary.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>Total</span>
                <span>{formatCurrency(summary.total, summary.currency)}</span>
              </div>
              {session.orderId ? (
                <p style={{ fontSize: '0.85rem', color: '#16a34a' }}>
                  Order reference <strong>{session.orderId}</strong> created.
                </p>
              ) : null}
            </div>
          </section>

          <section style={{ border: '1px solid #e2e8f0', borderRadius: '1.5rem', padding: '1.5rem', display: 'grid', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Next steps</h2>
            <p style={{ color: '#475569' }}>
              {session.status === 'SUBMITTED'
                ? 'We have received your order. You will receive an email confirmation shortly.'
                : 'Complete your payment when ready. This page will update automatically once the order is submitted.'}
            </p>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => router.push(`/${tenantSlug}/products`)}
                style={{
                  border: '1px solid #94a3b8',
                  borderRadius: '999px',
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  color: '#475569'
                }}
              >
                Browse more products
              </button>
              <button
                type="button"
                onClick={() => router.push(`/${tenantSlug}/checkout`)}
                style={{
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.85rem 1rem',
                  background: '#0ea5e9',
                  color: '#fff',
                  fontWeight: 600
                }}
              >
                Go back to checkout
              </button>
              {session && session.status !== 'SUBMITTED' ? (
                <button
                  type="button"
                  onClick={handleCompletePayment}
                  disabled={processing}
                  style={{
                    border: 'none',
                    borderRadius: '999px',
                    padding: '0.85rem 1rem',
                    background: processing ? '#94a3b8' : '#16a34a',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: processing ? 'not-allowed' : 'pointer'
                  }}
                >
                  {processing ? 'Processing…' : 'Complete payment'}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : (
        <p style={{ color: '#475569' }}>Loading checkout session details…</p>
      )}
    </div>
  )
}
