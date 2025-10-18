'use client'

import { useMemo, useState, ChangeEvent, FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useCart } from '../../../components/cart/CartContext'
import type { CheckoutSessionResource } from '../../../lib/cart-client'
import { PROVINCES, findProvince } from '../../../lib/nepal-address'

interface FormState {
  email: string
  phone: string
  fullName: string
  addressLine1: string
  addressLine2: string
  city: string
  province: string
  district: string
  postalCode: string
  shippingMethod: 'standard' | 'express'
  paymentMethod: 'cod' | 'card'
}

const DEFAULT_PROVINCE = PROVINCES[0]
const DEFAULT_DISTRICT = DEFAULT_PROVINCE.districts[0]

const INITIAL_FORM: FormState = {
  email: '',
  phone: '',
  fullName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  province: DEFAULT_PROVINCE.code,
  district: DEFAULT_DISTRICT.code,
  postalCode: '',
  shippingMethod: 'standard',
  paymentMethod: 'cod'
}

const SHIPPING_OPTIONS: Record<FormState['shippingMethod'], { id: string; label: string; amount: number }> = {
  standard: {
    id: 'standard',
    label: 'Standard (3-5 days)',
    amount: 0
  },
  express: {
    id: 'express',
    label: 'Express (1-2 days)',
    amount: 299
  }
}

function formatCurrency(amount: number, currency = 'NPR') {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency
  }).format(amount)
}

export default function CheckoutPage() {
  const { cart, beginCheckout, pending } = useCart()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = typeof params?.tenant === 'string' ? params.tenant : Array.isArray(params?.tenant) ? params?.tenant[0] : ''

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<CheckoutSessionResource | null>(null)

  if (!cart || cart.items.length === 0) {
    router.push(`/${tenantSlug}/products`)
    return null
  }

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value
    setForm((current) => {
      if (field === 'province') {
        const province = findProvince(value) ?? DEFAULT_PROVINCE
        return {
          ...current,
          province: province.code,
          district: province.districts[0]?.code ?? ''
        }
      }

      return { ...current, [field]: value }
    })
  }

  const selectedProvince = useMemo(
    () => findProvince(form.province) ?? DEFAULT_PROVINCE,
    [form.province]
  )

  const districtOptions = selectedProvince.districts

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const shipping = SHIPPING_OPTIONS[form.shippingMethod]
      const payloadShippingMethod = {
        id: shipping.id,
        label: shipping.label,
        amount: shipping.amount
      }
      const provinceMeta = selectedProvince
      const districtMeta = districtOptions.find((district) => district.code === form.district) ?? districtOptions[0]

      const payloadAddress = {
        fullName: form.fullName,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2 || null,
        city: form.city,
        province: provinceMeta?.name ?? '',
        provinceCode: provinceMeta?.code ?? '',
        district: districtMeta?.name ?? '',
        districtCode: districtMeta?.code ?? '',
        postalCode: form.postalCode,
        country: 'NP'
      }

      const result = await beginCheckout({
        email: form.email,
        phone: form.phone,
        shippingAddress: payloadAddress,
        billingAddress: payloadAddress,
        shippingMethod: payloadShippingMethod,
        metadata: {
          paymentMethod: form.paymentMethod
        }
      })

      setSession(result)
      if (tenantSlug) {
        router.push(`/${tenantSlug}/checkout/confirmation/${result.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout')
    } finally {
      setSubmitting(false)
    }
  }

  const totals = session
    ? {
        subtotal: session.subtotal,
        discountTotal: session.discountTotal,
        taxTotal: session.taxTotal,
        shippingTotal: session.shippingTotal,
        total: session.total,
        currency: session.currency,
        breakdown: session.breakdown
      }
    : {
        subtotal: cart.subtotal,
        discountTotal: cart.discountTotal,
        taxTotal: cart.taxTotal,
        shippingTotal: SHIPPING_OPTIONS[form.shippingMethod].amount,
        total: cart.total + SHIPPING_OPTIONS[form.shippingMethod].amount,
        currency: cart.currency,
        breakdown: cart.breakdown
      }

  return (
    <div style={{ maxWidth: '960px', margin: '2rem auto', padding: '1.5rem' }}>
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          border: 'none',
          background: 'transparent',
          color: '#0ea5e9',
          marginBottom: '1rem',
          cursor: 'pointer'
        }}
      >
        ← Back to cart
      </button>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Checkout</h1>
      <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Contact</h2>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                required
                placeholder="you@example.com"
                style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>Phone</span>
              <input
                type="tel"
                value={form.phone}
                onChange={handleChange('phone')}
                required
                placeholder="980-0000000"
                style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
              />
            </label>
          </section>
          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Payment</h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                checked={form.paymentMethod === 'cod'}
                onChange={handleChange('paymentMethod')}
              />
              Cash on delivery
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', color: '#94a3b8' }}>
              <input
                type="radio"
                name="paymentMethod"
                value="card"
                checked={form.paymentMethod === 'card'}
                onChange={handleChange('paymentMethod')}
                disabled
              />
              Card (coming soon)
            </label>
          </section>
          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Shipping</h2>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>Full name</span>
              <input
                type="text"
                value={form.fullName}
                onChange={handleChange('fullName')}
                required
                style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>Address line 1</span>
              <input
                type="text"
                value={form.addressLine1}
                onChange={handleChange('addressLine1')}
                required
                style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>Address line 2</span>
              <input
                type="text"
                value={form.addressLine2}
                onChange={handleChange('addressLine2')}
                placeholder="Apartment, suite, etc."
                style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
              />
            </label>
            <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>City</span>
                <input
                  type="text"
                  value={form.city}
                  onChange={handleChange('city')}
                  required
                  style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
                />
              </label>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>Province</span>
              <select
                value={form.province}
                onChange={handleChange('province')}
                required
                style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
              >
                {PROVINCES.map((province) => (
                  <option key={province.code} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </select>
            </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>District</span>
                <select
                  value={form.district}
                  onChange={handleChange('district')}
                  required
                  style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
                >
                  {districtOptions.map((district) => (
                    <option key={district.code} value={district.code}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Postal code</span>
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={handleChange('postalCode')}
                  required
                  style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
                />
              </label>
            </div>
          </section>
          <section style={{ display: 'grid', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Shipping method</h2>
            <select
              value={form.shippingMethod}
              onChange={handleChange('shippingMethod')}
              style={{ padding: '0.6rem 0.8rem', borderRadius: '0.75rem', border: '1px solid #cbd5f5' }}
            >
              {Object.entries(SHIPPING_OPTIONS).map(([key, option]) => (
                <option key={key} value={key}>
                  {option.label} ({formatCurrency(option.amount, cart.currency)})
                </option>
              ))}
            </select>
          </section>
          {error ? <p style={{ color: '#ef4444' }}>{error}</p> : null}
          <button
            type="submit"
            disabled={submitting || pending}
            style={{
              border: 'none',
              borderRadius: '999px',
              padding: '0.85rem 1rem',
              background: submitting || pending ? '#94a3b8' : '#0ea5e9',
              color: '#fff',
              fontWeight: 600,
              cursor: submitting || pending ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Calculating…' : 'Continue to payment'}
          </button>
        </form>
        <aside style={{ background: '#f8fafc', borderRadius: '1.5rem', padding: '1.5rem', display: 'grid', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Order summary</h2>
          <ul style={{ display: 'grid', gap: '0.75rem' }}>
            {cart.items.map((item) => (
              <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span>
                  {item.title ?? 'Product'} × {item.quantity}
                </span>
                <span>{formatCurrency(item.subtotal, cart.currency)}</span>
              </li>
            ))}
          </ul>
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'grid', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal, cart.currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span>Discounts</span>
              <span>-{formatCurrency(totals.discountTotal, cart.currency)}</span>
            </div>
            {totals.breakdown ? (
              <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'grid', gap: '0.15rem' }}>
                {totals.breakdown.discounts.lineItems > 0 ? (
                  <span>
                    • Line items: -{formatCurrency(totals.breakdown.discounts.lineItems, cart.currency)}
                  </span>
                ) : null}
                {totals.breakdown.discounts.order > 0 ? (
                  <span>
                    • Order promos: -{formatCurrency(totals.breakdown.discounts.order, cart.currency)}
                  </span>
                ) : null}
                {totals.breakdown.discounts.giftCards > 0 ? (
                  <span>
                    • Gift cards: -{formatCurrency(totals.breakdown.discounts.giftCards, cart.currency)}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span>Shipping</span>
              <span>{formatCurrency(totals.shippingTotal, totals.currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span>Tax</span>
              <span>{formatCurrency(totals.taxTotal, totals.currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <span>Total due</span>
              <span>{formatCurrency(totals.total, totals.currency)}</span>
            </div>
            {session ? (
              <p style={{ fontSize: '0.8rem', color: '#16a34a' }}>
                Checkout session prepared. Reference: <strong>{session.id}</strong>. Payment collection coming soon.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}
