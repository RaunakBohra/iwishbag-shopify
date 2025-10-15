'use client'

import { useState } from 'react'

type StepHandler = (data: Record<string, unknown>) => Promise<void> | void

interface BaseStepProps {
  initialData?: Record<string, unknown>
  onNext: StepHandler
  onBack?: () => void
  loading?: boolean
}

function createSubmitHandler(callback: StepHandler, data: Record<string, unknown>, loading?: boolean) {
  return async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    await callback(data)
  }
}

export function StoreDetailsStep({ initialData, onNext, loading }: BaseStepProps) {
  const [storeName, setStoreName] = useState((initialData?.storeName as string) ?? '')
  const [contactEmail, setContactEmail] = useState((initialData?.contactEmail as string) ?? '')

  const data = { storeName, contactEmail }

  return (
    <form className="step-card" onSubmit={createSubmitHandler(onNext, data, loading)}>
      <h2>Store details</h2>
      <label>
        Store name
        <input value={storeName} onChange={(event) => setStoreName(event.target.value)} required />
      </label>
      <label>
        Contact email
        <input
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save & Continue'}
      </button>
      <style jsx>{`
        .step-card {
          display: grid;
          gap: 1rem;
        }
        label {
          display: grid;
          gap: 0.5rem;
          font-weight: 500;
        }
        input,
        textarea,
        select {
          padding: 0.65rem;
          border-radius: 0.5rem;
          border: 1px solid #e4e4e7;
          font-size: 0.95rem;
        }
        button {
          padding: 0.75rem 1.25rem;
          border-radius: 0.5rem;
          background-color: #2563eb;
          color: #fff;
          border: none;
          font-weight: 600;
          cursor: pointer;
        }
        button[disabled] {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  )
}

export function PaymentSetupStep({ initialData, onNext, onBack, loading }: BaseStepProps) {
  const [provider, setProvider] = useState((initialData?.provider as string) ?? 'esewa')

  return (
    <form
      className="step-card"
      onSubmit={createSubmitHandler(onNext, { provider }, loading)}
    >
      <h2>Payments</h2>
      <label>
        Preferred provider
        <select value={provider} onChange={(event) => setProvider(event.target.value)}>
          <option value="esewa">eSewa</option>
          <option value="khalti">Khalti</option>
          <option value="cash-on-delivery">Cash on delivery</option>
        </select>
      </label>
      <div className="step-card__actions">
        <button type="button" onClick={onBack} className="secondary">
          Back
        </button>
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
      <style jsx>{`
        .step-card__actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }
        button.secondary {
          background: #f4f4f5;
          color: #27272a;
        }
      `}</style>
    </form>
  )
}

export function ShippingSetupStep({ initialData, onNext, onBack, loading }: BaseStepProps) {
  const [shippingNote, setShippingNote] = useState((initialData?.note as string) ?? '')

  return (
    <form
      className="step-card"
      onSubmit={createSubmitHandler(onNext, { note: shippingNote }, loading)}
    >
      <h2>Shipping</h2>
      <label>
        Shipping preferences
        <textarea
          rows={4}
          placeholder="Describe your delivery areas, carriers, rates..."
          value={shippingNote}
          onChange={(event) => setShippingNote(event.target.value)}
        />
      </label>
      <div className="step-card__actions">
        <button type="button" onClick={onBack} className="secondary">
          Back
        </button>
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </form>
  )
}

export function FirstProductStep({ initialData, onNext, onBack, loading }: BaseStepProps) {
  const [productName, setProductName] = useState((initialData?.productName as string) ?? '')

  return (
    <form
      className="step-card"
      onSubmit={createSubmitHandler(onNext, { productName }, loading)}
    >
      <h2>First product</h2>
      <label>
        Product name
        <input value={productName} onChange={(event) => setProductName(event.target.value)} />
      </label>
      <div className="step-card__actions">
        <button type="button" onClick={onBack} className="secondary">
          Back
        </button>
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </form>
  )
}

export function ThemeSelectionStep({ initialData, onNext, onBack, loading }: BaseStepProps) {
  const [theme, setTheme] = useState((initialData?.theme as string) ?? 'modern-default')

  return (
    <form
      className="step-card"
      onSubmit={createSubmitHandler(onNext, { theme }, loading)}
    >
      <h2>Theme</h2>
      <label className="radio">
        <input
          type="radio"
          value="modern-default"
          checked={theme === 'modern-default'}
          onChange={(event) => setTheme(event.target.value)}
        />
        Modern Default
      </label>
      <label className="radio">
        <input
          type="radio"
          value="classic"
          checked={theme === 'classic'}
          onChange={(event) => setTheme(event.target.value)}
        />
        Classic Shop
      </label>
      <div className="step-card__actions">
        <button type="button" onClick={onBack} className="secondary">
          Back
        </button>
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
      <style jsx>{`
        .radio {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
      `}</style>
    </form>
  )
}

interface GoLiveStepProps extends BaseStepProps {
  onRestart?: () => void
}

export function GoLiveStep({ onBack, onNext, initialData, loading }: GoLiveStepProps) {
  const [accept, setAccept] = useState((initialData?.accepted as boolean) ?? false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    await onNext({ accepted: accept, completed: true })
  }

  return (
    <form className="step-card" onSubmit={handleSubmit}>
      <h2>Launch checklist</h2>
      <label className="checkbox">
        <input type="checkbox" checked={accept} onChange={(event) => setAccept(event.target.checked)} />
        I reviewed my store configuration and I'm ready to launch.
      </label>
      <div className="step-card__actions">
        <button type="button" onClick={onBack} className="secondary">
          Back
        </button>
        <button type="submit" disabled={!accept || loading}>
          {loading ? 'Publishing...' : 'Finish onboarding'}
        </button>
      </div>
      <style jsx>{`
        .checkbox {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
        }
        input[type='checkbox'] {
          margin-top: 0.25rem;
        }
      `}</style>
    </form>
  )
}
