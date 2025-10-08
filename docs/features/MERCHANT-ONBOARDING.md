# Merchant Onboarding Implementation Guide

Complete implementation guide for the merchant onboarding process after registration.

---

## Table of Contents

1. [Overview](#overview)
2. [Onboarding Steps](#onboarding-steps)
3. [Store Setup](#store-setup)
4. [Payment Gateway Setup](#payment-gateway-setup)
5. [Shipping Configuration](#shipping-configuration)
6. [First Product Tutorial](#first-product-tutorial)
7. [Theme Selection](#theme-selection)
8. [Go Live Checklist](#go-live-checklist)

---

## Overview

### Onboarding Flow

```
Registration Complete
        ↓
Step 1: Store Details
  - Logo upload
  - Store description
  - Contact info
        ↓
Step 2: Payment Setup
  - Select payment methods
  - Enter credentials (optional)
        ↓
Step 3: Shipping Setup
  - Delivery zones
  - Shipping rates
  - Pathao/Tootle integration
        ↓
Step 4: First Product
  - Add product tutorial
  - Quick add form
        ↓
Step 5: Theme Selection
  - Choose design theme
  - Customize colors
        ↓
Step 6: Go Live
  - Review checklist
  - Launch store
        ↓
Dashboard
```

---

## Onboarding Steps

### Progress Tracker Component

**`apps/merchant/components/onboarding/ProgressTracker.tsx`**:

```typescript
'use client'

interface Step {
  id: number
  name: string
  status: 'completed' | 'current' | 'upcoming'
}

interface ProgressTrackerProps {
  currentStep: number
  steps: Step[]
}

export function ProgressTracker({ currentStep, steps }: ProgressTrackerProps) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center">
        {steps.map((step, stepIdx) => (
          <li
            key={step.id}
            className={`relative ${
              stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''
            } flex-1`}
          >
            {step.status === 'completed' ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-primary-600" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary-600">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="mt-2 text-xs font-medium text-neutral-900 block text-center">
                  {step.name}
                </span>
              </>
            ) : step.status === 'current' ? (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-neutral-200" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary-600 bg-white">
                  <span className="text-primary-600 font-semibold text-sm">{step.id}</span>
                </div>
                <span className="mt-2 text-xs font-medium text-primary-600 block text-center">
                  {step.name}
                </span>
              </>
            ) : (
              <>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="h-0.5 w-full bg-neutral-200" />
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-neutral-300 bg-white">
                  <span className="text-neutral-500 font-semibold text-sm">{step.id}</span>
                </div>
                <span className="mt-2 text-xs font-medium text-neutral-500 block text-center">
                  {step.name}
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

### Main Onboarding Page

**`apps/merchant/app/onboarding/page.tsx`**:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressTracker } from '@/components/onboarding/ProgressTracker'
import { StoreDetailsStep } from '@/components/onboarding/StoreDetailsStep'
import { PaymentSetupStep } from '@/components/onboarding/PaymentSetupStep'
import { ShippingSetupStep } from '@/components/onboarding/ShippingSetupStep'
import { FirstProductStep } from '@/components/onboarding/FirstProductStep'
import { ThemeSelectionStep } from '@/components/onboarding/ThemeSelectionStep'
import { GoLiveStep } from '@/components/onboarding/GoLiveStep'

const steps = [
  { id: 1, name: 'Store Details', status: 'current' as const },
  { id: 2, name: 'Payments', status: 'upcoming' as const },
  { id: 3, name: 'Shipping', status: 'upcoming' as const },
  { id: 4, name: 'First Product', status: 'upcoming' as const },
  { id: 5, name: 'Theme', status: 'upcoming' as const },
  { id: 6, name: 'Go Live', status: 'upcoming' as const }
]

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [onboardingData, setOnboardingData] = useState({})
  const [stepsStatus, setStepsStatus] = useState(steps)

  useEffect(() => {
    // Check if onboarding is already complete
    checkOnboardingStatus()
  }, [])

  const checkOnboardingStatus = async () => {
    const token = localStorage.getItem('token')

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenant/onboarding-status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const data = await response.json()

    if (data.completed) {
      router.push('/dashboard')
    } else if (data.currentStep) {
      setCurrentStep(data.currentStep)
    }
  }

  const updateStepStatus = (stepId: number, status: 'completed' | 'current' | 'upcoming') => {
    setStepsStatus(prev =>
      prev.map(step =>
        step.id === stepId ? { ...step, status } : step
      )
    )
  }

  const handleNext = (data: any) => {
    // Save step data
    setOnboardingData(prev => ({ ...prev, ...data }))

    // Mark current step as completed
    updateStepStatus(currentStep, 'completed')

    // Move to next step
    const nextStep = currentStep + 1
    if (nextStep <= 6) {
      setCurrentStep(nextStep)
      updateStepStatus(nextStep, 'current')
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      updateStepStatus(currentStep, 'upcoming')
      setCurrentStep(currentStep - 1)
      updateStepStatus(currentStep - 1, 'current')
    }
  }

  const handleSkip = () => {
    handleNext({})
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StoreDetailsStep onNext={handleNext} />
      case 2:
        return <PaymentSetupStep onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />
      case 3:
        return <ShippingSetupStep onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />
      case 4:
        return <FirstProductStep onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />
      case 5:
        return <ThemeSelectionStep onNext={handleNext} onBack={handleBack} />
      case 6:
        return <GoLiveStep onboardingData={onboardingData} onBack={handleBack} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-4xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-neutral-900">Welcome to NepShop!</h1>
          <p className="text-neutral-600 mt-2">
            Let's set up your store in just a few minutes
          </p>
        </div>

        {/* Progress Tracker */}
        <div className="mb-12">
          <ProgressTracker currentStep={currentStep} steps={stepsStatus} />
        </div>

        {/* Current Step */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {renderStep()}
        </div>
      </div>
    </div>
  )
}
```

---

## Store Setup

**`apps/merchant/components/onboarding/StoreDetailsStep.tsx`**:

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'

const storeDetailsSchema = z.object({
  logo: z.any().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  contactEmail: z.string().email(),
  contactPhone: z.string().regex(/^[0-9]{10}$/),
  address: z.string().min(5),
  province: z.string(),
  district: z.string(),
  postalCode: z.string().optional()
})

type StoreDetailsForm = z.infer<typeof storeDetailsSchema>

interface Props {
  onNext: (data: any) => void
}

export function StoreDetailsStep({ onNext }: Props) {
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<StoreDetailsForm>({
    resolver: zodResolver(storeDetailsSchema)
  })

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to R2
    setUploading(true)

    const formData = new FormData()
    formData.append('image', file)

    const token = localStorage.getItem('token')

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await response.json()

      if (data.url) {
        // Store URL for later
        localStorage.setItem('tempLogoUrl', data.url)
      }
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }

  const onSubmit = async (data: StoreDetailsForm) => {
    const logoUrl = localStorage.getItem('tempLogoUrl')
    const token = localStorage.getItem('token')

    // Save to database
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenant/update`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        logo: logoUrl,
        description: data.description,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        address: data.address,
        province: data.province,
        district: data.district,
        postalCode: data.postalCode
      })
    })

    if (response.ok) {
      onNext(data)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Store Details</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Store Logo
          </label>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-neutral-100">
                <Image src={logoPreview} alt="Logo preview" width={96} height={96} className="object-cover" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-lg bg-neutral-100 flex items-center justify-center">
                <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}

            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
              />
              <label
                htmlFor="logo-upload"
                className="cursor-pointer bg-white border border-neutral-300 rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {uploading ? 'Uploading...' : 'Upload Logo'}
              </label>
              <p className="text-xs text-neutral-500 mt-1">PNG, JPG up to 5MB</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Store Description
          </label>
          <textarea
            {...register('description')}
            rows={4}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Tell customers about your store..."
          />
          {errors.description && (
            <p className="text-danger-600 text-sm mt-1">{errors.description.message}</p>
          )}
        </div>

        {/* Contact Email */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Contact Email
          </label>
          <input
            type="email"
            {...register('contactEmail')}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="contact@yourstore.com"
          />
          {errors.contactEmail && (
            <p className="text-danger-600 text-sm mt-1">{errors.contactEmail.message}</p>
          )}
        </div>

        {/* Contact Phone */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Contact Phone
          </label>
          <input
            type="tel"
            {...register('contactPhone')}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="9800000000"
          />
          {errors.contactPhone && (
            <p className="text-danger-600 text-sm mt-1">{errors.contactPhone.message}</p>
          )}
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Store Address
          </label>
          <input
            type="text"
            {...register('address')}
            className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Street address"
          />
          {errors.address && (
            <p className="text-danger-600 text-sm mt-1">{errors.address.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Province */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Province
            </label>
            <select
              {...register('province')}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select province</option>
              <option value="bagmati">Bagmati Pradesh</option>
              <option value="gandaki">Gandaki Pradesh</option>
              <option value="province1">Province No. 1</option>
              {/* ... all provinces */}
            </select>
            {errors.province && (
              <p className="text-danger-600 text-sm mt-1">{errors.province.message}</p>
            )}
          </div>

          {/* District */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              District
            </label>
            <select
              {...register('district')}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select district</option>
              <option value="kathmandu">Kathmandu</option>
              <option value="lalitpur">Lalitpur</option>
              <option value="bhaktapur">Bhaktapur</option>
              {/* ... all districts */}
            </select>
            {errors.district && (
              <p className="text-danger-600 text-sm mt-1">{errors.district.message}</p>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-primary-600 hover:bg-primary-500 text-white font-semibold px-6 py-3 rounded-lg"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  )
}
```

---

## Payment Gateway Setup

**`apps/merchant/components/onboarding/PaymentSetupStep.tsx`**:

```typescript
'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Props {
  onNext: (data: any) => void
  onBack: () => void
  onSkip: () => void
}

export function PaymentSetupStep({ onNext, onBack, onSkip }: Props) {
  const [selectedMethods, setSelectedMethods] = useState<string[]>([])
  const [cashOnDelivery, setCashOnDelivery] = useState(true)

  const paymentMethods = [
    {
      id: 'esewa',
      name: 'eSewa',
      logo: '/payment-logos/esewa.png',
      description: '5M+ users in Nepal',
      fee: '2%',
      setupRequired: false // Platform handles API
    },
    {
      id: 'khalti',
      name: 'Khalti',
      logo: '/payment-logos/khalti.png',
      description: '3M+ users',
      fee: '3.5%',
      setupRequired: false
    },
    {
      id: 'imepay',
      name: 'IME Pay',
      logo: '/payment-logos/imepay.png',
      description: 'Bank-backed wallet',
      fee: '2.5%',
      setupRequired: false
    },
    {
      id: 'connectips',
      name: 'ConnectIPS',
      logo: '/payment-logos/connectips.png',
      description: 'Direct bank transfer',
      fee: '1.5%',
      setupRequired: false
    }
  ]

  const toggleMethod = (methodId: string) => {
    if (selectedMethods.includes(methodId)) {
      setSelectedMethods(selectedMethods.filter(id => id !== methodId))
    } else {
      setSelectedMethods([...selectedMethods, methodId])
    }
  }

  const handleContinue = async () => {
    const token = localStorage.getItem('token')

    // Save payment methods
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tenant/payment-methods`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        methods: selectedMethods,
        cashOnDelivery
      })
    })

    onNext({ paymentMethods: selectedMethods, cashOnDelivery })
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-neutral-900 mb-2">Payment Methods</h2>
      <p className="text-neutral-600 mb-6">
        Select how you want to accept payments. All Nepal payment gateways included at NO EXTRA cost!
      </p>

      {/* Cash on Delivery */}
      <div className="mb-6 p-4 border-2 border-success-200 bg-success-50 rounded-lg">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={cashOnDelivery}
            onChange={(e) => setCashOnDelivery(e.target.checked)}
            className="h-5 w-5 text-success-600 focus:ring-success-500 border-neutral-300 rounded"
          />
          <div className="ml-3">
            <span className="font-semibold text-neutral-900">Cash on Delivery (COD)</span>
            <p className="text-sm text-neutral-600">Most popular in Nepal - No fees!</p>
          </div>
        </label>
      </div>

      {/* Digital Payment Methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {paymentMethods.map((method) => (
          <div
            key={method.id}
            onClick={() => toggleMethod(method.id)}
            className={`p-4 border-2 rounded-lg cursor-pointer transition ${
              selectedMethods.includes(method.id)
                ? 'border-primary-600 bg-primary-50'
                : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <div className="flex items-start">
              <input
                type="checkbox"
                checked={selectedMethods.includes(method.id)}
                onChange={() => {}}
                className="mt-1 h-5 w-5 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
              />
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-900">{method.name}</span>
                  <span className="text-xs bg-accent-100 text-accent-700 px-2 py-1 rounded">
                    {method.fee} fee
                  </span>
                </div>
                <p className="text-sm text-neutral-600 mt-1">{method.description}</p>
                {!method.setupRequired && (
                  <p className="text-xs text-success-600 mt-2">✓ No setup required</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-primary-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="ml-3">
            <p className="text-sm text-primary-800 font-medium">Platform Advantage</p>
            <p className="text-sm text-primary-700 mt-1">
              NepShop covers the Rs 25,000-30,000 API integration costs. All payment gateways work out of the box!
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="bg-white border border-neutral-300 text-neutral-700 font-semibold px-6 py-3 rounded-lg hover:bg-neutral-50"
        >
          Back
        </button>

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="bg-white border border-neutral-300 text-neutral-700 font-semibold px-6 py-3 rounded-lg hover:bg-neutral-50"
          >
            Skip for Now
          </button>
          <button
            onClick={handleContinue}
            disabled={!cashOnDelivery && selectedMethods.length === 0}
            className="bg-primary-600 hover:bg-primary-500 text-white font-semibold px-6 py-3 rounded-lg disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

**Shipping Setup**, **First Product**, **Theme Selection**, and **Go Live** steps follow similar patterns with forms, API calls, and navigation buttons.

---

**Last Updated**: October 7, 2025
**Version**: 1.0.0
