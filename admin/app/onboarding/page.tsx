'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ProgressTracker } from '../../components/onboarding/ProgressTracker'
import {
  StoreDetailsStep,
  PaymentSetupStep,
  ShippingSetupStep,
  FirstProductStep,
  ThemeSelectionStep,
  GoLiveStep
} from '../../components/onboarding/steps'

const TOTAL_STEPS = 6
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')

interface StatusResponse {
  tenantId: string
  currentStep: number
  completed: boolean
  steps: Record<string, Record<string, unknown>>
}

const stepLabels = [
  'Store details',
  'Payments',
  'Shipping',
  'First product',
  'Theme',
  'Go live'
]

const stepComponents = {
  1: StoreDetailsStep,
  2: PaymentSetupStep,
  3: ShippingSetupStep,
  4: FirstProductStep,
  5: ThemeSelectionStep,
  6: GoLiveStep
} as const

export default function OnboardingPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [stepsData, setStepsData] = useState<Record<string, Record<string, unknown>>>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!API_BASE) {
      setError('NEXT_PUBLIC_API_URL is not set.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : undefined
      const response = await fetch(`${API_BASE}/v1/onboarding`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const body = (await response.json()) as { data: StatusResponse }
      setStatus(body.data)
      setStepsData((body.data.steps ?? {}) as Record<string, Record<string, unknown>>)
    } catch (err) {
      console.error(err)
      setError('Unable to load onboarding status. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const stepsForTracker = useMemo(() => {
    if (!status) {
      return stepLabels.map((label, index) => ({
        id: index + 1,
        name: label,
        status: 'upcoming' as const
      }))
    }

    return stepLabels.map((label, index) => {
      const stepNumber = index + 1
      let stepStatus: 'completed' | 'current' | 'upcoming' = 'upcoming'

      if (status.completed) {
        stepStatus = 'completed'
      } else if (stepNumber < status.currentStep) {
        stepStatus = 'completed'
      } else if (stepNumber === status.currentStep) {
        stepStatus = 'current'
      }

      return {
        id: stepNumber,
        name: label,
        status: stepStatus
      }
    })
  }, [status])

  const currentStep = status?.currentStep ?? 1
  const StepComponent = stepComponents[currentStep as keyof typeof stepComponents]

  const handleStepSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      if (!API_BASE) return

      setSubmitting(true)
      setError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : undefined
        const payload = {
          step: currentStep,
          data,
          completed: data.completed === true
        }

        const response = await fetch(`${API_BASE}/v1/onboarding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          credentials: 'include',
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          throw new Error(await response.text())
        }

        const body = (await response.json()) as { data: StatusResponse }
        setStatus(body.data)
        setStepsData((body.data.steps ?? {}) as Record<string, Record<string, unknown>>)
      } catch (err) {
        console.error(err)
        setError('Unable to save progress. Please try again.')
      } finally {
        setSubmitting(false)
      }
    },
    [API_BASE, currentStep]
  )

  const handleBack = useCallback(() => {
    setStatus((prev) => {
      if (!prev) {
        return prev
      }

      const previousStep = Math.max(1, prev.currentStep - 1)
      return {
        ...prev,
        currentStep: previousStep,
        completed: false
      }
    })
  }, [])

  if (!API_BASE) {
    return (
      <main className="onboarding-container">
        <p className="error">Set NEXT_PUBLIC_API_URL to use the onboarding wizard.</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="onboarding-container">
        <p>Loading onboarding progress…</p>
      </main>
    )
  }

  if (status?.completed) {
    return (
      <main className="onboarding-container">
        <section className="completion">
          <h1>🎉 Store onboarding complete</h1>
          <p>Your store is ready. You can revisit the wizard anytime to review your settings.</p>
        </section>
      </main>
    )
  }

  if (!StepComponent) {
    return (
      <main className="onboarding-container">
        <p className="error">Unknown onboarding step.</p>
      </main>
    )
  }

  const initialData = stepsData[String(currentStep)]

  return (
    <main className="onboarding-container">
      <header className="onboarding-header">
        <h1>Merchant onboarding</h1>
        <p>Complete the steps below to launch your store.</p>
      </header>

      <ProgressTracker steps={stepsForTracker} />

      {error ? <p className="error">{error}</p> : null}

      <section className="onboarding-step">
        <StepComponent
          initialData={initialData}
          onNext={handleStepSubmit}
          onBack={currentStep > 1 ? handleBack : undefined}
          loading={submitting}
        />
      </section>

      <style jsx>{`
        .onboarding-container {
          max-width: 56rem;
          margin: 0 auto;
          padding: 3rem 1.5rem 4rem;
          display: grid;
          gap: 2rem;
        }
        .onboarding-header h1 {
          font-size: 2.25rem;
          margin-bottom: 0.5rem;
        }
        .onboarding-header p {
          color: #6b7280;
          font-size: 1.05rem;
        }
        .onboarding-step {
          background: #ffffff;
          border: 1px solid #e4e4e7;
          border-radius: 1rem;
          padding: 2rem;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
        }
        .error {
          color: #dc2626;
          font-weight: 500;
        }
        .completion {
          text-align: center;
          padding: 4rem 2rem;
          background: #ecfdf5;
          border-radius: 1rem;
          border: 1px solid #bbf7d0;
        }
        .completion h1 {
          font-size: 2rem;
          margin-bottom: 1rem;
        }
      `}</style>
    </main>
  )
}
