'use client'

import { useMemo, useState, ChangeEvent, FormEvent, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { z } from 'zod'
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

const PROVINCE_CODES = PROVINCES.map((province) => province.code) as [string, ...string[]]
const SHIPPING_METHODS = ['standard', 'express'] as const
const PAYMENT_METHODS = ['cod', 'card'] as const

const CheckoutFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .min(7, 'Phone number must be at least 7 digits')
    .max(32, 'Phone number is too long'),
  fullName: z.string().trim().min(1, 'Full name is required'),
  addressLine1: z.string().trim().min(1, 'Address line 1 is required'),
  addressLine2: z.string().optional().transform((value) => (value ?? '').trim()),
  city: z.string().trim().min(1, 'City is required'),
  province: z.enum(PROVINCE_CODES, { errorMap: () => ({ message: 'Province is required' }) }),
  district: z.string().trim().min(1, 'District is required'),
  postalCode: z.string().trim().min(1, 'Postal code is required'),
  shippingMethod: z.enum(SHIPPING_METHODS, { errorMap: () => ({ message: 'Choose a shipping method' }) }),
  paymentMethod: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: 'Select a payment option' }) })
})

type CheckoutFormInput = z.infer<typeof CheckoutFormSchema>
type FormErrors = Partial<Record<keyof CheckoutFormInput, string>>
const FIELD_ERROR_STYLE = { color: '#ef4444', fontSize: '0.8rem' } as const

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
  const { cart, beginCheckout, pending, loading } = useCart()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = typeof params?.tenant === 'string' ? params.tenant : Array.isArray(params?.tenant) ? params?.tenant[0] : ''

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<CheckoutSessionResource | null>(null)

  useEffect(() => {
    if (!tenantSlug || loading) {
      return
    }
    if (!cart || cart.items.length === 0) {
      router.replace(`/${tenantSlug}/products`)
    }
  }, [cart, tenantSlug, router, loading])

  if (loading) {
    return (
      <div style={{ maxWidth: '960px', margin: '2rem auto', padding: '1.5rem', color: '#475569' }}>
        Loading your cart…
      </div>
    )
  }

  if (!cart || cart.items.length === 0) {
    return null
  }

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value
    setError(null)
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[field]
      if (field === 'province') {
        delete next.district
      }
      return next
    })
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
      const validation = CheckoutFormSchema.safeParse(form)
      if (!validation.success) {
        const message = validation.error.issues[0]?.message ?? 'Please correct the highlighted fields'
        const nextErrors: FormErrors = {}
        for (const issue of validation.error.issues) {
          const pathKey = issue.path[0]
          if (typeof pathKey === 'string' && nextErrors[pathKey as keyof CheckoutFormInput] === undefined) {
            nextErrors[pathKey as keyof CheckoutFormInput] = issue.message
          }
        }
        setFieldErrors(nextErrors)
        setError(message)
        return
      }

      setFieldErrors({})
      const data = validation.data
      setForm((current) => ({ ...current, ...data }))

      const shipping = SHIPPING_OPTIONS[data.shippingMethod]
      const payloadShippingMethod = {
        id: shipping.id,
        label: shipping.label,
        amount: shipping.amount
      }
      const provinceMeta = findProvince(data.province) ?? DEFAULT_PROVINCE
      const districtMeta =
        provinceMeta.districts.find((district) => district.code === data.district) ?? provinceMeta.districts[0]

      const payloadAddress = {
        fullName: data.fullName,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 ? data.addressLine2 : null,
        city: data.city,
        province: provinceMeta?.name ?? '',
        provinceCode: provinceMeta?.code ?? '',
        district: districtMeta?.name ?? '',
        districtCode: districtMeta?.code ?? '',
        postalCode: data.postalCode,
        country: 'NP'
      }

      const result = await beginCheckout({
        email: data.email,
        phone: data.phone,
        shippingAddress: payloadAddress,
        billingAddress: payloadAddress,
        shippingMethod: payloadShippingMethod,
        metadata: {
          paymentMethod: data.paymentMethod
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
              {fieldErrors.email ? <span style={FIELD_ERROR_STYLE}>{fieldErrors.email}</span> : null}
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
              {fieldErrors.phone ? <span style={FIELD_ERROR_STYLE}>{fieldErrors.phone}</span> : null}
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
            {fieldErrors.paymentMethod ? <span style={FIELD_ERROR_STYLE}>{fieldErrors.paymentMethod}</span> : null}
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
              {fieldErrors.fullName ? <span style={FIELD_ERROR_STYLE}>{fieldErrors.fullName}</span> : null}
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
              {fieldErrors.addressLine1 ? <span style={FIELD_ERROR_STYLE}>{fieldErrors.addressLine1}</span> : null}
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
                {fieldErrors.city ? <span style={FIELD_ERROR_STYLE}>{fieldErrors.city}</span> : null}
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
              {fieldErrors.province ? <span style={FIELD_ERROR_STYLE}>{fieldErrors.province}</span> : null}
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
                {fieldErrors.district ? <span style={FIELD_ERROR_STYLE}>{fieldErrors.district}</span> : null}
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
                {fieldErrors.postalCode ? <span style={FIELD_ERROR_STYLE}>{fieldErrors.postalCode}</span> : null}
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
            {fieldErrors.shippingMethod ? <span style={FIELD_ERROR_STYLE}>{fieldErrors.shippingMethod}</span> : null}
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
                {totals.breakdown.shipping.discount > 0 ? (
                  <span>
                    • Shipping discount: -{formatCurrency(totals.breakdown.shipping.discount, cart.currency)}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span>Shipping</span>
              <span>{formatCurrency(totals.shippingTotal, totals.currency)}</span>
            </div>
            {totals.breakdown?.shipping.original !== null &&
            totals.breakdown?.shipping.original !== undefined &&
            totals.breakdown.shipping.original > totals.shippingTotal ? (
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Original shipping {formatCurrency(totals.breakdown.shipping.original, totals.currency)}
              </span>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span>Tax</span>
              <span>{formatCurrency(totals.taxTotal, totals.currency)}</span>
            </div>
            {totals.breakdown?.tax.rate ? (
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Estimated tax rate {totals.breakdown.tax.rate.toFixed(2)}%
              </span>
            ) : null}
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
