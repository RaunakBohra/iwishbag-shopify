export interface OnboardingStatus {
  tenantId: string
  currentStep: number
  completed: boolean
  steps: Record<string, unknown>
}

export type OnboardingCardState =
  | { status: 'loading'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'complete'; message: string }
  | { status: 'needs-action'; message: string; currentStep: number; totalSteps: number }
