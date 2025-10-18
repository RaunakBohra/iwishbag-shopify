'use client'

import posthog from 'posthog-js'

let initialized = false

interface InitOptions {
  debug?: boolean
}

export function initPosthog(options: InitOptions = {}) {
  if (initialized) {
    return
  }

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST

  if (!apiKey || !host) {
    if (options.debug) {
      console.warn('[posthog] Missing NEXT_PUBLIC_POSTHOG_KEY or NEXT_PUBLIC_POSTHOG_HOST')
    }
    return
  }

  posthog.init(apiKey, {
    api_host: host,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'memory',
    loaded: () => {
      initialized = true
      if (options.debug) {
        console.info('[posthog] Initialized')
      }
    }
  })
}

export function capture(event: string, properties?: Record<string, unknown>) {
  if (!initialized) {
    return
  }

  posthog.capture(event, properties)
}

export function identify(distinctId: string, properties?: Record<string, unknown>) {
  if (!initialized) {
    return
  }

  posthog.identify(distinctId, properties)
}
