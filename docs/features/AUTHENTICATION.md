# Authentication System Implementation Guide

Complete implementation guide for the authentication and authorization system.

---

## Table of Contents

1. [Overview](#overview)
2. [User Types](#user-types)
3. [Authentication Flow](#authentication-flow)
4. [Registration](#registration)
5. [Login](#login)
6. [Password Management](#password-management)
7. [Session Management](#session-management)
8. [Multi-Factor Authentication](#multi-factor-authentication)
9. [Role-Based Access Control](#role-based-access-control)
10. [Security Features](#security-features)

---

## Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Login    │  │  Signup    │  │   Profile  │            │
│  │   Form     │  │   Form     │  │  Settings  │            │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘            │
└────────┼────────────────┼────────────────┼──────────────────┘
         │                │                │
         │ POST /auth     │ POST /auth     │ GET /auth
         │    /login      │    /register   │    /me
         │                │                │
┌────────▼────────────────▼────────────────▼──────────────────┐
│                 API (Cloudflare Workers)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Auth Middleware                         │   │
│  │  - Verify JWT                                       │   │
│  │  - Check session in KV                              │   │
│  │  - Validate permissions                             │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   bcrypt     │  │   JWT        │  │   Session    │      │
│  │   Password   │  │   Tokens     │  │   in KV      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                     Database (Neon)                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   users    │  │   roles    │  │ permissions│            │
│  └────────────┘  └────────────┘  └────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

---

## User Types

### 1. Platform Admin
- Manages entire platform
- Views all tenants
- Handles billing and subscriptions
- Accesses admin dashboard

### 2. Merchant Owner
- Creates and owns tenant
- Full control over their store
- Manages team members
- Configures store settings

### 3. Merchant Staff
- Limited access to tenant
- Manages products, orders
- No billing or team management
- Role-based permissions

### 4. Customer
- Shops on storefronts
- Creates orders
- Manages profile
- Tenant-specific accounts

---

## Authentication Flow

### Registration Flow

```
User visits signup page
        ↓
Fills registration form
        ↓
Frontend validates inputs
        ↓
POST /auth/register
        ↓
API validates email uniqueness
        ↓
Hash password (bcrypt)
        ↓
Create user in database
        ↓
Create tenant (for merchants)
        ↓
Provision tenant database
        ↓
Generate JWT token
        ↓
Create session in KV
        ↓
Return token to frontend
        ↓
Redirect to onboarding
```

### Login Flow

```
User visits login page
        ↓
Enters credentials
        ↓
POST /auth/login
        ↓
Find user by email
        ↓
Verify password (bcrypt)
        ↓
Check 2FA (if enabled)
        ↓
Generate JWT token
        ↓
Create session in KV
        ↓
Return token
        ↓
Redirect to dashboard
```

---

## Registration

### Backend Implementation

**`apps/api/src/routes/auth.ts`**:

```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { sign } from 'hono/jwt'
import { Env } from '../index'
import { PrismaClient } from '@prisma/client'
import { provisionTenantDatabase } from '../services/database'

const app = new Hono<{ Bindings: Env }>()

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(2).max(100),
  storeName: z.string().min(2).max(100),
  phone: z.string().regex(/^[0-9]{10}$/),
  businessType: z.enum(['individual', 'company'])
})

app.post('/register', async (c) => {
  try {
    // Parse and validate request
    const body = await c.req.json()
    const data = registerSchema.parse(body)

    const db = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL
    })

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: data.email }
    })

    if (existingUser) {
      return c.json({ error: 'Email already registered' }, 400)
    }

    // Generate store slug from store name
    const baseSlug = data.storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    // Check slug uniqueness
    let slug = baseSlug
    let counter = 1
    while (await db.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 10)

    // Create tenant
    const tenant = await db.tenant.create({
      data: {
        name: data.storeName,
        slug: slug,
        planId: null, // Free plan (no plan_id)
        planStatus: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        timezone: 'Asia/Kathmandu',
        currency: 'NPR',
        language: 'ne',
        businessType: data.businessType
      }
    })

    // Create user
    const user = await db.user.create({
      data: {
        email: data.email,
        passwordHash: passwordHash,
        name: data.name,
        phone: data.phone,
        tenantId: tenant.id,
        role: 'owner',
        status: 'active',
        emailVerified: false
      }
    })

    // Provision tenant database (async)
    c.executionCtx.waitUntil(
      provisionTenantDatabase(tenant.id, tenant.name, c.env)
    )

    // Generate JWT
    const token = await sign(
      {
        userId: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
      },
      c.env.JWT_SECRET
    )

    // Create session in KV
    await c.env.SESSIONS.put(
      `session:${user.id}`,
      JSON.stringify({
        userId: user.id,
        tenantId: tenant.id,
        email: user.email,
        role: user.role,
        createdAt: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
      }),
      { expirationTtl: 7 * 24 * 60 * 60 }
    )

    // Send welcome email (via queue)
    await c.env.BACKGROUND_JOBS.send({
      type: 'email',
      to: user.email,
      subject: 'Welcome to NepShop!',
      template: 'welcome',
      data: {
        name: user.name,
        storeName: tenant.name,
        storeUrl: `https://${tenant.slug}.nepshop.store`,
        dashboardUrl: 'https://merchant.nepshop.com'
      },
      tenantId: tenant.id
    })

    await db.$disconnect()

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        storeUrl: `https://${tenant.slug}.nepshop.store`
      }
    }, 201)

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        error: 'Validation failed',
        details: error.errors
      }, 400)
    }

    console.error('Registration error:', error)
    return c.json({ error: 'Registration failed' }, 500)
  }
})

export { app as authRoutes }
```

### Frontend Implementation

**`apps/web/app/signup/page.tsx`**:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number'),
  confirmPassword: z.string(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  storeName: z.string().min(2, 'Store name must be at least 2 characters'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone must be 10 digits'),
  businessType: z.enum(['individual', 'company']),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: 'You must agree to terms and conditions'
  })
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
})

type SignupForm = z.infer<typeof signupSchema>

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema)
  })

  const onSubmit = async (data: SignupForm) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name,
          storeName: data.storeName,
          phone: data.phone,
          businessType: data.businessType
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed')
      }

      // Store token
      localStorage.setItem('token', result.token)
      localStorage.setItem('user', JSON.stringify(result.user))
      localStorage.setItem('tenant', JSON.stringify(result.tenant))

      // Redirect to onboarding
      router.push('/onboarding')

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-neutral-900">Create Your Store</h1>
          <p className="text-neutral-600 mt-2">Start selling online in minutes</p>
        </div>

        {error && (
          <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Store Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Store Name
            </label>
            <input
              type="text"
              {...register('storeName')}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="My Awesome Store"
            />
            {errors.storeName && (
              <p className="text-danger-600 text-sm mt-1">{errors.storeName.message}</p>
            )}
          </div>

          {/* Your Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              {...register('name')}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="John Doe"
            />
            {errors.name && (
              <p className="text-danger-600 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Email
            </label>
            <input
              type="email"
              {...register('email')}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="text-danger-600 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              {...register('phone')}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="9800000000"
            />
            {errors.phone && (
              <p className="text-danger-600 text-sm mt-1">{errors.phone.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Password
            </label>
            <input
              type="password"
              {...register('password')}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-danger-600 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              {...register('confirmPassword')}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="text-danger-600 text-sm mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Business Type */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Business Type
            </label>
            <select
              {...register('businessType')}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
            {errors.businessType && (
              <p className="text-danger-600 text-sm mt-1">{errors.businessType.message}</p>
            )}
          </div>

          {/* Terms */}
          <div className="flex items-start">
            <input
              type="checkbox"
              {...register('agreeToTerms')}
              className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
            />
            <label className="ml-2 text-sm text-neutral-700">
              I agree to the{' '}
              <a href="/terms" className="text-primary-600 hover:text-primary-500">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-primary-600 hover:text-primary-500">
                Privacy Policy
              </a>
            </label>
          </div>
          {errors.agreeToTerms && (
            <p className="text-danger-600 text-sm">{errors.agreeToTerms.message}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Your Store...' : 'Create Store'}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-600 mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-primary-600 hover:text-primary-500 font-medium">
            Log in
          </a>
        </p>
      </div>
    </div>
  )
}
```

---

## Login

### Backend Implementation

**`apps/api/src/routes/auth.ts`** (continued):

```typescript
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

app.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const data = loginSchema.parse(body)

    const db = new PrismaClient({
      datasourceUrl: c.env.DATABASE_URL
    })

    // Find user
    const user = await db.user.findUnique({
      where: { email: data.email },
      include: { tenant: true }
    })

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Check if user is active
    if (user.status !== 'active') {
      return c.json({ error: 'Account is inactive' }, 403)
    }

    // Verify password
    const validPassword = await bcrypt.compare(data.password, user.passwordHash)

    if (!validPassword) {
      // Log failed attempt
      await db.loginAttempt.create({
        data: {
          userId: user.id,
          ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
          success: false,
          userAgent: c.req.header('user-agent') || 'unknown'
        }
      })

      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate temporary token for 2FA verification
      const tempToken = crypto.randomUUID()

      await c.env.TEMP.put(
        `2fa:${tempToken}`,
        JSON.stringify({ userId: user.id }),
        { expirationTtl: 5 * 60 } // 5 minutes
      )

      return c.json({
        requires2FA: true,
        tempToken
      })
    }

    // Generate JWT
    const token = await sign(
      {
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
      },
      c.env.JWT_SECRET
    )

    // Create session
    await c.env.SESSIONS.put(
      `session:${user.id}`,
      JSON.stringify({
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        createdAt: Date.now(),
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
      }),
      { expirationTtl: 7 * 24 * 60 * 60 }
    )

    // Log successful login
    await db.loginAttempt.create({
      data: {
        userId: user.id,
        ipAddress: c.req.header('cf-connecting-ip') || 'unknown',
        success: true,
        userAgent: c.req.header('user-agent') || 'unknown'
      }
    })

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    await db.$disconnect()

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400)
    }

    console.error('Login error:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

// Get current user
app.get('/me', async (c) => {
  const userId = c.get('userId') as string
  const tenantId = c.get('tenantId') as string

  const db = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL
  })

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          planStatus: true
        }
      }
    }
  })

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  await db.$disconnect()

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled
    },
    tenant: user.tenant
  })
})

// Logout
app.post('/logout', async (c) => {
  const userId = c.get('userId') as string

  // Delete session
  await c.env.SESSIONS.delete(`session:${userId}`)

  return c.json({ success: true })
})
```

### Frontend Login Page

**`apps/web/app/login/page.tsx`**:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required')
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema)
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Login failed')
      }

      // Check for 2FA
      if (result.requires2FA) {
        router.push(`/verify-2fa?token=${result.tempToken}`)
        return
      }

      // Store token
      localStorage.setItem('token', result.token)
      localStorage.setItem('user', JSON.stringify(result.user))
      localStorage.setItem('tenant', JSON.stringify(result.tenant))

      // Redirect based on role
      if (result.user.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-neutral-900">Welcome Back</h1>
          <p className="text-neutral-600 mt-2">Log in to your account</p>
        </div>

        {error && (
          <div className="bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Email
            </label>
            <input
              type="email"
              {...register('email')}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="text-danger-600 text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Password
            </label>
            <input
              type="password"
              {...register('password')}
              className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-danger-600 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
              />
              <span className="ml-2 text-sm text-neutral-700">Remember me</span>
            </label>

            <a href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-500">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-600 mt-6">
          Don't have an account?{' '}
          <a href="/signup" className="text-primary-600 hover:text-primary-500 font-medium">
            Sign up
          </a>
        </p>
      </div>
    </div>
  )
}
```

---

## Password Management

### Password Reset Flow

```typescript
// Request password reset
app.post('/auth/forgot-password', async (c) => {
  const { email } = await c.req.json()

  const db = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL })

  const user = await db.user.findUnique({
    where: { email }
  })

  if (!user) {
    // Don't reveal if email exists
    return c.json({ success: true })
  }

  // Generate reset token
  const resetToken = crypto.randomUUID()

  // Store in KV (valid for 1 hour)
  await c.env.TEMP.put(
    `reset:${resetToken}`,
    JSON.stringify({ userId: user.id }),
    { expirationTtl: 60 * 60 }
  )

  // Send reset email
  await c.env.BACKGROUND_JOBS.send({
    type: 'email',
    to: user.email,
    subject: 'Reset Your Password',
    template: 'password-reset',
    data: {
      name: user.name,
      resetUrl: `https://nepshop.com/reset-password?token=${resetToken}`
    },
    tenantId: user.tenantId
  })

  await db.$disconnect()

  return c.json({ success: true })
})

// Reset password
app.post('/auth/reset-password', async (c) => {
  const { token, newPassword } = await c.req.json()

  // Validate password strength
  if (newPassword.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }

  // Get token from KV
  const data = await c.env.TEMP.get(`reset:${token}`, 'json')

  if (!data) {
    return c.json({ error: 'Invalid or expired token' }, 400)
  }

  const { userId } = data as { userId: string }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 10)

  // Update password
  const db = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL })

  await db.user.update({
    where: { id: userId },
    data: { passwordHash }
  })

  // Delete token
  await c.env.TEMP.delete(`reset:${token}`)

  // Invalidate all sessions
  await c.env.SESSIONS.delete(`session:${userId}`)

  await db.$disconnect()

  return c.json({ success: true })
})
```

---

## Multi-Factor Authentication

> **Backend status:** Authentication API now supports full 2FA lifecycle. `/v1/auth/login` responds with `{ requiresTwoFactor: true, tempToken }` when TOTP is enabled, `/v1/auth/2fa/login` completes the challenge, and `/v1/auth/2fa/setup` / `/v1/auth/2fa/verify` expose secret onboarding + recovery codes.

### Setup 2FA

```typescript
import { authenticator } from 'otplib'
import qrcode from 'qrcode'

// Enable 2FA
app.post('/auth/2fa/setup', async (c) => {
  const userId = c.get('userId') as string

  const db = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL })

  const user = await db.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  // Generate secret
  const secret = authenticator.generateSecret()

  // Generate OTP auth URL
  const otpauth = authenticator.keyuri(
    user.email,
    'NepShop',
    secret
  )

  // Generate QR code
  const qrCode = await qrcode.toDataURL(otpauth)

  // Store secret temporarily (until verified)
  await c.env.TEMP.put(
    `2fa-setup:${userId}`,
    secret,
    { expirationTtl: 10 * 60 } // 10 minutes
  )

  await db.$disconnect()

  return c.json({
    secret,
    qrCode,
    manualEntry: secret
  })
})

// Verify and enable 2FA
app.post('/auth/2fa/verify', async (c) => {
  const userId = c.get('userId') as string
  const { code } = await c.req.json()

  // Get temporary secret
  const secret = await c.env.TEMP.get(`2fa-setup:${userId}`)

  if (!secret) {
    return c.json({ error: 'Setup expired' }, 400)
  }

  // Verify code
  const isValid = authenticator.verify({
    token: code,
    secret: secret
  })

  if (!isValid) {
    return c.json({ error: 'Invalid code' }, 400)
  }

  // Save secret to user
  const db = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL })

  await db.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret,
      twoFactorEnabled: true
    }
  })

  // Delete temp secret
  await c.env.TEMP.delete(`2fa-setup:${userId}`)

  await db.$disconnect()

  return c.json({ success: true })
})

// Verify 2FA during login
app.post('/auth/2fa/login', async (c) => {
  const { tempToken, code } = await c.req.json()

  // Get user from temp token
  const data = await c.env.TEMP.get(`2fa:${tempToken}`, 'json')

  if (!data) {
    return c.json({ error: 'Invalid or expired token' }, 400)
  }

  const { userId } = data as { userId: string }

  const db = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL })

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { tenant: true }
  })

  if (!user || !user.twoFactorSecret) {
    return c.json({ error: 'Invalid request' }, 400)
  }

  // Verify code
  const isValid = authenticator.verify({
    token: code,
    secret: user.twoFactorSecret
  })

  if (!isValid) {
    return c.json({ error: 'Invalid code' }, 400)
  }

  // Generate JWT (same as regular login)
  const token = await sign(
    {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
    },
    c.env.JWT_SECRET
  )

  // Create session
  await c.env.SESSIONS.put(
    `session:${user.id}`,
    JSON.stringify({
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      createdAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
    }),
    { expirationTtl: 7 * 24 * 60 * 60 }
  )

  // Delete temp token
  await c.env.TEMP.delete(`2fa:${tempToken}`)

  await db.$disconnect()

  return c.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug
    }
  })
})
```

---

## Role-Based Access Control

### Permission Middleware

```typescript
// apps/api/src/middleware/permissions.ts

export function requirePermission(permission: string) {
  return async (c: Context, next: Next) => {
    const role = c.get('role') as string
    const tenantId = c.get('tenantId') as string

    const db = new PrismaClient({ datasourceUrl: c.env.DATABASE_URL })

    // Get role permissions
    const roleData = await db.role.findUnique({
      where: { name: role },
      include: { permissions: true }
    })

    if (!roleData) {
      return c.json({ error: 'Invalid role' }, 403)
    }

    // Check if role has permission
    const hasPermission = roleData.permissions.some(
      p => p.name === permission
    )

    if (!hasPermission) {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }

    await db.$disconnect()
    await next()
  }
}

// Usage
app.delete(
  '/products/:id',
  requirePermission('products.delete'),
  async (c) => {
    // Delete product
  }
)
```

---

**Last Updated**: October 7, 2025
**Version**: 1.0.0
