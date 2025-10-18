'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ProgressTracker } from '../../components/onboarding/ProgressTracker'
import {
  StoreDetailsStep,
  PaymentSetupStep,
  ShippingSetupStep,
  FirstProductStep,
  ThemeSelectionStep,
  GoLiveStep,
  OnboardingStepStyles
} from '../../components/onboarding/steps'
import { capture, initPosthog } from '../../lib/posthog'
import { api } from '../../lib/api-client'

const TOTAL_STEPS = 6

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
  const lastTrackedStep = useRef<number | null>(null)
  const completionTracked = useRef<boolean>(false)

  useEffect(() => {
    initPosthog()
  }, [])

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const body = await api.get<{ data: StatusResponse }>('/v1/onboarding')
      setStatus(body.data)
      setStepsData((body.data.steps ?? {}) as Record<string, Record<string, unknown>>)
      if (body.data.completed && !completionTracked.current) {
        capture('onboarding_completed', {
          tenantId: body.data.tenantId,
          completedAt: new Date().toISOString()
        })
        completionTracked.current = true
      }
    } catch (err) {
      console.error(err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage.includes('Session expired')
        ? 'Your session has expired. Redirecting to login...'
        : 'Unable to load onboarding status. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (!status || status.completed) {
      return
    }

    if (lastTrackedStep.current === status.currentStep) {
      return
    }

    capture('onboarding_step_viewed', {
      tenantId: status.tenantId,
      step: status.currentStep
    })
    lastTrackedStep.current = status.currentStep
  }, [status])

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
      setSubmitting(true)
      setError(null)
      try {
        const payload = {
          step: currentStep,
          data,
          completed: data.completed === true
        }

        const body = await api.post<{ data: StatusResponse }>('/v1/onboarding', payload)
        setStatus(body.data)
        setStepsData((body.data.steps ?? {}) as Record<string, Record<string, unknown>>)

        capture('onboarding_step_saved', {
          tenantId: body.data.tenantId,
          step: payload.step,
          completed: payload.completed === true
        })

        if (payload.completed === true && !completionTracked.current) {
          capture('onboarding_completed', {
            tenantId: body.data.tenantId,
            completedAt: new Date().toISOString()
          })
          completionTracked.current = true
        } else if (body.data.completed && !completionTracked.current) {
          capture('onboarding_completed', {
            tenantId: body.data.tenantId,
            completedAt: new Date().toISOString()
          })
          completionTracked.current = true
        }
      } catch (err) {
        console.error(err)
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage.includes('Session expired')
          ? 'Your session has expired. Redirecting to login...'
          : 'Unable to save progress. Please try again.')
      } finally {
        setSubmitting(false)
      }
    },
    [currentStep]
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

  if (loading) {
    return (
      <main className="onboarding-container">
        <OnboardingStepStyles />
        <p>Loading onboarding progress…</p>
      </main>
    )
  }

  if (status?.completed) {
    return (
      <main className="onboarding-container">
        <OnboardingStepStyles />
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
        <OnboardingStepStyles />
        <p className="error">Unknown onboarding step.</p>
      </main>
    )
  }

  const initialData = stepsData[String(currentStep)]

  return (
    <main className="onboarding-container">
      <OnboardingStepStyles />
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
          max-width: 60rem;
          margin: 0 auto;
          padding: 3rem 1.5rem 4rem;
          display: grid;
          gap: 2.5rem;
        }
        .onboarding-header h1 {
          font-size: 2.25rem;
          margin-bottom: 0.5rem;
          color: #f8fafc;
        }
        .onboarding-header p {
          color: #94a3b8;
          font-size: 1.05rem;
        }
        .onboarding-step {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .error {
          color: #f97316;
          font-weight: 500;
        }
        .completion {
          text-align: center;
          padding: 4rem 2rem;
          background: rgba(13, 148, 136, 0.12);
          border-radius: 1rem;
          border: 1px solid rgba(94, 234, 212, 0.4);
        }
        .completion h1 {
          font-size: 2rem;
          margin-bottom: 1rem;
        }
      `}</style>
    </main>
  )
}
