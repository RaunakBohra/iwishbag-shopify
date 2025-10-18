'use client'

import { useState } from 'react'

type StepHandler = (data: Record<string, unknown>) => Promise<void> | void

interface BaseStepProps {
  initialData?: Record<string, unknown>
  onNext: StepHandler
  onBack?: () => void
  loading?: boolean
}

const CARD_CLASS = 'iwb-step-card'
const FIELD_CLASS = 'iwb-step-field'
const ACTIONS_CLASS = 'iwb-step-actions'
const PRIMARY_BUTTON_CLASS = 'iwb-step-button'
const SECONDARY_BUTTON_CLASS = 'iwb-step-button secondary'
const ERROR_CLASS = 'iwb-step-error'

export function StoreDetailsStep({ initialData, onNext, loading }: BaseStepProps) {
  const [storeName, setStoreName] = useState((initialData?.storeName as string) ?? '')
  const [contactEmail, setContactEmail] = useState((initialData?.contactEmail as string) ?? '')
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    const trimmedStoreName = storeName.trim()
    const trimmedEmail = contactEmail.trim()
    const nextErrors: string[] = []

    if (trimmedStoreName.length < 3) {
      nextErrors.push('Store name should be at least 3 characters.')
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.push('Enter a valid contact email.')
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors([])
    await onNext({ storeName: trimmedStoreName, contactEmail: trimmedEmail })
  }

  return (
    <form className={CARD_CLASS} onSubmit={handleSubmit} noValidate>
      <header>
        <p className="iwb-step-eyebrow">Step 1</p>
        <h2>Store details</h2>
        <p className="iwb-step-helper">Add a storefront name and contact email that customers will see on receipts.</p>
      </header>
      <label className={FIELD_CLASS}>
        <span>Store name</span>
        <input
          value={storeName}
          onChange={(event) => setStoreName(event.target.value)}
          placeholder="Example: Himalayan Threads"
          aria-invalid={errors.length > 0 && storeName.trim().length < 3}
        />
      </label>
      <label className={FIELD_CLASS}>
        <span>Contact email</span>
        <input
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          placeholder="ops@yourstore.com"
          aria-invalid={errors.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())}
        />
      </label>
      {errors.length > 0 && (
        <ul className={ERROR_CLASS}>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <div className={ACTIONS_CLASS}>
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={loading}>
          {loading ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
    </form>
  )
}

export function PaymentSetupStep({ initialData, onNext, onBack, loading }: BaseStepProps) {
  const [provider, setProvider] = useState((initialData?.provider as string) ?? 'esewa')
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    if (!provider) {
      setErrors(['Select a provider to continue.'])
      return
    }

    setErrors([])
    await onNext({ provider })
  }

  return (
    <form className={CARD_CLASS} onSubmit={handleSubmit} noValidate>
      <header>
        <p className="iwb-step-eyebrow">Step 2</p>
        <h2>Payments</h2>
        <p className="iwb-step-helper">Select the primary payment method. You can add more providers later.</p>
      </header>
      <label className={FIELD_CLASS}>
        <span>Preferred provider</span>
        <select value={provider} onChange={(event) => setProvider(event.target.value)}>
          <option value="esewa">eSewa</option>
          <option value="khalti">Khalti</option>
          <option value="cash-on-delivery">Cash on delivery</option>
        </select>
      </label>
      {errors.length > 0 && (
        <ul className={ERROR_CLASS}>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <div className={ACTIONS_CLASS}>
        <button type="button" onClick={onBack} className={SECONDARY_BUTTON_CLASS}>
          Back
        </button>
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={loading}>
          {loading ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
    </form>
  )
}

export function ShippingSetupStep({ initialData, onNext, onBack, loading }: BaseStepProps) {
  const [shippingNote, setShippingNote] = useState((initialData?.note as string) ?? '')
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    const trimmed = shippingNote.trim()
    if (trimmed.length === 0) {
      setErrors(['Describe delivery coverage or SLA expectations to keep ops aligned.'])
      return
    }

    setErrors([])
    await onNext({ note: trimmed })
  }

  return (
    <form className={CARD_CLASS} onSubmit={handleSubmit} noValidate>
      <header>
        <p className="iwb-step-eyebrow">Step 3</p>
        <h2>Shipping</h2>
        <p className="iwb-step-helper">
          Outline delivery areas, partners, and cut-off times so fulfilment stays aligned during launch.
        </p>
      </header>
      <label className={FIELD_CLASS}>
        <span>Shipping preferences</span>
        <textarea
          rows={4}
          placeholder="Example: Kathmandu Valley next-day via Pathao; nationwide 3-5 days via Nepal Post."
          value={shippingNote}
          onChange={(event) => setShippingNote(event.target.value)}
          aria-invalid={errors.length > 0 && shippingNote.trim().length === 0}
        />
      </label>
      {errors.length > 0 && (
        <ul className={ERROR_CLASS}>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <div className={ACTIONS_CLASS}>
        <button type="button" onClick={onBack} className={SECONDARY_BUTTON_CLASS}>
          Back
        </button>
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={loading}>
          {loading ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
    </form>
  )
}

export function FirstProductStep({ initialData, onNext, onBack, loading }: BaseStepProps) {
  const [productName, setProductName] = useState((initialData?.productName as string) ?? '')
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return

    const trimmed = productName.trim()
    if (trimmed.length === 0) {
      setErrors(['Add a product name so we can seed catalog data.'])
      return
    }

    setErrors([])
    await onNext({ productName: trimmed })
  }

  return (
    <form className={CARD_CLASS} onSubmit={handleSubmit} noValidate>
      <header>
        <p className="iwb-step-eyebrow">Step 4</p>
        <h2>First product</h2>
        <p className="iwb-step-helper">Name the first product we’ll preload once the demo catalog seeds.</p>
      </header>
      <label className={FIELD_CLASS}>
        <span>Product name</span>
        <input
          value={productName}
          onChange={(event) => setProductName(event.target.value)}
          placeholder="Example: Everest Down Jacket"
          aria-invalid={errors.length > 0 && productName.trim().length === 0}
        />
      </label>
      {errors.length > 0 && (
        <ul className={ERROR_CLASS}>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <div className={ACTIONS_CLASS}>
        <button type="button" onClick={onBack} className={SECONDARY_BUTTON_CLASS}>
          Back
        </button>
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={loading}>
          {loading ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
    </form>
  )
}

export function ThemeSelectionStep({ initialData, onNext, onBack, loading }: BaseStepProps) {
  const [theme, setTheme] = useState((initialData?.theme as string) ?? 'modern-default')
  const themes = [
    {
      id: 'modern-default',
      name: 'Modern Default',
      description: 'Minimal storefront with large imagery and quick-buy buttons.'
    },
    {
      id: 'classic',
      name: 'Classic Shop',
      description: 'Traditional grid layout, ideal for large SKU counts.'
    }
  ]

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    await onNext({ theme })
  }

  return (
    <form className={CARD_CLASS} onSubmit={handleSubmit} noValidate>
      <header>
        <p className="iwb-step-eyebrow">Step 5</p>
        <h2>Theme</h2>
        <p className="iwb-step-helper">Pick the launch theme. Merchants can customize sections later in the builder.</p>
      </header>
      <div className="iwb-step-theme-picker">
        {themes.map((option) => (
          <label key={option.id} className="iwb-step-theme">
            <input
              type="radio"
              value={option.id}
              checked={theme === option.id}
              onChange={(event) => setTheme(event.target.value)}
            />
            <div>
              <p className="name">{option.name}</p>
              <p className="description">{option.description}</p>
            </div>
          </label>
        ))}
      </div>
      <div className={ACTIONS_CLASS}>
        <button type="button" onClick={onBack} className={SECONDARY_BUTTON_CLASS}>
          Back
        </button>
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={loading}>
          {loading ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
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
    <form className={CARD_CLASS} onSubmit={handleSubmit} noValidate>
      <header>
        <p className="iwb-step-eyebrow">Step 6</p>
        <h2>Launch checklist</h2>
        <p className="iwb-step-helper">Confirm readiness and we’ll mark onboarding complete while queueing go-live tasks.</p>
      </header>
      <label className="iwb-step-checkbox">
        <input type="checkbox" checked={accept} onChange={(event) => setAccept(event.target.checked)} />
        <span>I reviewed my store configuration and I&apos;m ready to launch.</span>
      </label>
      <div className={ACTIONS_CLASS}>
        <button type="button" onClick={onBack} className={SECONDARY_BUTTON_CLASS}>
          Back
        </button>
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={!accept || loading}>
          {loading ? 'Publishing…' : 'Finish onboarding'}
        </button>
      </div>
    </form>
  )
}

export function OnboardingStepStyles() {
  return (
    <style jsx global>{`
      .${CARD_CLASS} {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        border-radius: 1.5rem;
        border: 1px solid rgba(15, 23, 42, 0.75);
        background: rgba(2, 6, 23, 0.85);
        padding: 1.75rem;
        box-shadow: 0 20px 45px rgba(2, 6, 23, 0.6);
      }

      .${CARD_CLASS} header h2 {
        margin: 0.4rem 0 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #f8fafc;
      }

      .iwb-step-eyebrow {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.28em;
        color: #38bdf8;
        font-weight: 600;
      }

      .iwb-step-helper {
        margin-top: 0.4rem;
        font-size: 0.85rem;
        color: #94a3b8;
      }

      .${FIELD_CLASS} {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        font-size: 0.9rem;
        color: #cbd5f5;
      }

      .${FIELD_CLASS} > span {
        font-weight: 600;
        color: #e2e8f0;
      }

      .${FIELD_CLASS} input,
      .${FIELD_CLASS} select,
      .${FIELD_CLASS} textarea {
        border-radius: 0.9rem;
        border: 1px solid rgba(148, 163, 184, 0.25);
        background: rgba(15, 23, 42, 0.6);
        padding: 0.75rem 0.95rem;
        color: #e2e8f0;
        font-size: 0.95rem;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .${FIELD_CLASS} input:focus,
      .${FIELD_CLASS} select:focus,
      .${FIELD_CLASS} textarea:focus {
        outline: none;
        border-color: rgba(94, 234, 212, 0.7);
        box-shadow: 0 0 0 3px rgba(94, 234, 212, 0.2);
      }

      .${FIELD_CLASS} input[aria-invalid='true'],
      .${FIELD_CLASS} textarea[aria-invalid='true'] {
        border-color: rgba(251, 191, 36, 0.6);
      }

      .${ACTIONS_CLASS} {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }

      .${PRIMARY_BUTTON_CLASS} {
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(56, 189, 248, 0.8), rgba(16, 185, 129, 0.8));
        border: none;
        color: #041420;
        font-weight: 600;
        padding: 0.7rem 1.7rem;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .${PRIMARY_BUTTON_CLASS}:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        box-shadow: none;
      }

      .${PRIMARY_BUTTON_CLASS}:not(:disabled):hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 30px rgba(14, 116, 144, 0.35);
      }

      .${SECONDARY_BUTTON_CLASS} {
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(15, 23, 42, 0.55);
        color: #cbd5f5;
        padding: 0.7rem 1.5rem;
        font-weight: 600;
        cursor: pointer;
      }

      .${SECONDARY_BUTTON_CLASS}:hover {
        border-color: rgba(148, 163, 184, 0.6);
      }

      .${ERROR_CLASS} {
        list-style: disc;
        margin: 0;
        padding-left: 1.5rem;
        background: rgba(251, 191, 36, 0.1);
        border: 1px solid rgba(251, 191, 36, 0.4);
        color: #facc15;
        border-radius: 0.9rem;
        padding: 0.8rem 1.1rem;
        font-size: 0.85rem;
      }

      .iwb-step-theme-picker {
        display: grid;
        gap: 0.85rem;
      }

      .iwb-step-theme {
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
        padding: 0.9rem 1rem;
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 1rem;
        background: rgba(15, 23, 42, 0.45);
        cursor: pointer;
        transition: border-color 0.2s ease, background 0.2s ease;
      }

      .iwb-step-theme input {
        margin-top: 0.35rem;
      }

      .iwb-step-theme .name {
        font-weight: 600;
        color: #f1f5f9;
      }

      .iwb-step-theme .description {
        font-size: 0.85rem;
        color: #94a3b8;
        margin-top: 0.25rem;
      }

      .iwb-step-theme input:checked + div,
      .iwb-step-theme:has(input:checked) {
        border-color: rgba(94, 234, 212, 0.5);
        background: rgba(13, 148, 136, 0.15);
      }

      .iwb-step-checkbox {
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
        font-size: 0.9rem;
        color: #cbd5f5;
      }

      .iwb-step-checkbox input {
        margin-top: 0.2rem;
      }
    `}</style>
  )
}
